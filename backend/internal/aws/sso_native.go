package aws

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sso"
	"github.com/aws/aws-sdk-go-v2/service/ssooidc"
	"github.com/aws/aws-sdk-go-v2/service/ssooidc/types"
)

const (
	// ClientName is the name used when registering with AWS SSO OIDC
	ClientName = "bridge-k8s-dashboard"
	// ClientType for public clients (no secret)
	ClientType = "public"
	// GrantType for device authorization flow
	GrantType = "urn:ietf:params:oauth:grant-type:device_code"
)

// SSOClient handles AWS SSO OIDC operations using native SDK
type SSOClient struct {
	storage *Storage
}

// NewSSOClient creates a new SSO client
func NewSSOClient() *SSOClient {
	return &SSOClient{
		storage: NewStorage(),
	}
}

// DeviceAuthorizationResult contains the result of starting device authorization
type DeviceAuthorizationResult struct {
	DeviceCode              string `json:"deviceCode"`
	UserCode                string `json:"userCode"`
	VerificationUri         string `json:"verificationUri"`
	VerificationUriComplete string `json:"verificationUriComplete"`
	ExpiresIn               int32  `json:"expiresIn"`
	Interval                int32  `json:"interval"`
	ClientId                string `json:"clientId"`
	ClientSecret            string `json:"clientSecret"`
	StartUrl                string `json:"startUrl"`
	Region                  string `json:"region"`
}

// TokenResult contains the access token after successful authorization
type TokenResult struct {
	AccessToken  string    `json:"accessToken"`
	TokenType    string    `json:"tokenType"`
	ExpiresAt    time.Time `json:"expiresAt"`
	RefreshToken string    `json:"refreshToken,omitempty"`
	StartUrl     string    `json:"startUrl"`
	Region       string    `json:"region"`
}

// Account represents an AWS account accessible via SSO
type Account struct {
	AccountId   string `json:"accountId"`
	AccountName string `json:"accountName"`
	EmailAddr   string `json:"emailAddress"`
}

// AccountRole represents a role in an AWS account
type AccountRole struct {
	RoleName  string `json:"roleName"`
	AccountId string `json:"accountId"`
}

// AccountWithRoles represents an account with its available roles
type AccountWithRoles struct {
	Account
	Roles []string `json:"roles"`
}

// SSOSession represents a stored SSO session with its accounts
type SSOSession struct {
	Name        string             `json:"name"`
	StartUrl    string             `json:"startUrl"`
	Region      string             `json:"region"`
	Accounts    []AccountWithRoles `json:"accounts"`
	LastSynced  time.Time          `json:"lastSynced"`
	TokenExpiry time.Time          `json:"tokenExpiry,omitempty"`
}

// RoleCredentials represents temporary AWS credentials for a role
type RoleCredentials struct {
	AccessKeyId     string    `json:"accessKeyId"`
	SecretAccessKey string    `json:"secretAccessKey"`
	SessionToken    string    `json:"sessionToken"`
	Expiration      time.Time `json:"expiration"`
}

// SessionStatus represents the status of an SSO session
type SessionStatus struct {
	Name        string    `json:"name"`
	StartUrl    string    `json:"startUrl"`
	Region      string    `json:"region"`
	IsLoggedIn  bool      `json:"isLoggedIn"`
	TokenExpiry time.Time `json:"tokenExpiry,omitempty"`
	LastSynced  time.Time `json:"lastSynced,omitempty"`
}

// createOIDCClient creates a new SSO OIDC client for the given region
func createOIDCClient(ctx context.Context, region string) (*ssooidc.Client, error) {
	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(region))
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}
	return ssooidc.NewFromConfig(cfg), nil
}

// createSSOClient creates a new SSO client for the given region
func createSSOClient(ctx context.Context, region string) (*sso.Client, error) {
	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(region))
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}
	return sso.NewFromConfig(cfg), nil
}

// StartDeviceAuthorization initiates the device authorization flow using native AWS SDK
func (c *SSOClient) StartDeviceAuthorization(ctx context.Context, startUrl, region string) (*DeviceAuthorizationResult, error) {
	oidcClient, err := createOIDCClient(ctx, region)
	if err != nil {
		return nil, err
	}

	// Step 1: Register client with AWS SSO OIDC
	registerOutput, err := oidcClient.RegisterClient(ctx, &ssooidc.RegisterClientInput{
		ClientName: aws.String(ClientName),
		ClientType: aws.String(ClientType),
		Scopes:     []string{"sso:account:access"},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to register client: %w", err)
	}

	// Step 2: Start device authorization
	authOutput, err := oidcClient.StartDeviceAuthorization(ctx, &ssooidc.StartDeviceAuthorizationInput{
		ClientId:     registerOutput.ClientId,
		ClientSecret: registerOutput.ClientSecret,
		StartUrl:     aws.String(startUrl),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to start device authorization: %w", err)
	}

	result := &DeviceAuthorizationResult{
		DeviceCode:              aws.ToString(authOutput.DeviceCode),
		UserCode:                aws.ToString(authOutput.UserCode),
		VerificationUri:         aws.ToString(authOutput.VerificationUri),
		VerificationUriComplete: aws.ToString(authOutput.VerificationUriComplete),
		ExpiresIn:               authOutput.ExpiresIn,
		Interval:                authOutput.Interval,
		ClientId:                aws.ToString(registerOutput.ClientId),
		ClientSecret:            aws.ToString(registerOutput.ClientSecret),
		StartUrl:                startUrl,
		Region:                  region,
	}

	// Store the pending authorization (includes clientId and clientSecret for later use)
	if err := c.storage.StorePendingAuth(result); err != nil {
		log.Printf("Warning: failed to store pending auth: %v", err)
	}

	return result, nil
}

// PollForToken polls for the token using native AWS SDK
func (c *SSOClient) PollForToken(ctx context.Context, deviceCode, clientId, clientSecret, region, startUrl string, interval int32, expiresIn int32) (*TokenResult, error) {
	oidcClient, err := createOIDCClient(ctx, region)
	if err != nil {
		return nil, err
	}

	pollInterval := time.Duration(interval) * time.Second
	if pollInterval < 1*time.Second {
		pollInterval = 5 * time.Second
	}

	timeout := time.Duration(expiresIn) * time.Second
	if timeout < 1*time.Minute {
		timeout = 5 * time.Minute
	}

	deadline := time.Now().Add(timeout)

	for time.Now().Before(deadline) {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
			// Attempt to create token
			tokenOutput, err := oidcClient.CreateToken(ctx, &ssooidc.CreateTokenInput{
				ClientId:     aws.String(clientId),
				ClientSecret: aws.String(clientSecret),
				DeviceCode:   aws.String(deviceCode),
				GrantType:    aws.String(GrantType),
			})

			if err != nil {
				// Check for specific SSO OIDC exceptions
				var authPending *types.AuthorizationPendingException
				var slowDown *types.SlowDownException
				var expiredToken *types.ExpiredTokenException
				var accessDenied *types.AccessDeniedException

				if errors.As(err, &authPending) {
					// Authorization is still pending, wait and retry
					time.Sleep(pollInterval)
					continue
				}
				if errors.As(err, &slowDown) {
					// We're polling too fast, increase interval
					pollInterval += 5 * time.Second
					time.Sleep(pollInterval)
					continue
				}
				if errors.As(err, &expiredToken) {
					return nil, fmt.Errorf("device code expired, please start authorization again")
				}
				if errors.As(err, &accessDenied) {
					return nil, fmt.Errorf("access denied: user rejected authorization or session expired")
				}

				// Check error message for authorization pending (fallback)
				if strings.Contains(err.Error(), "AuthorizationPendingException") ||
					strings.Contains(err.Error(), "authorization_pending") {
					time.Sleep(pollInterval)
					continue
				}
				if strings.Contains(err.Error(), "SlowDownException") ||
					strings.Contains(err.Error(), "slow_down") {
					pollInterval += 5 * time.Second
					time.Sleep(pollInterval)
					continue
				}

				return nil, fmt.Errorf("token creation failed: %w", err)
			}

			// Success! Token received
			expiresAt := time.Now().Add(time.Duration(tokenOutput.ExpiresIn) * time.Second)

			result := &TokenResult{
				AccessToken:  aws.ToString(tokenOutput.AccessToken),
				TokenType:    aws.ToString(tokenOutput.TokenType),
				ExpiresAt:    expiresAt,
				RefreshToken: aws.ToString(tokenOutput.RefreshToken),
				StartUrl:     startUrl,
				Region:       region,
			}

			// Store the token
			if err := c.storage.StoreToken(startUrl, result); err != nil {
				log.Printf("Warning: failed to store token: %v", err)
			}

			// Clean up pending auth
			c.storage.DeletePendingAuth(startUrl)

			return result, nil
		}
	}

	return nil, fmt.Errorf("authorization timed out")
}

// ListAccounts lists all AWS accounts using native AWS SDK
func (c *SSOClient) ListAccounts(ctx context.Context, accessToken, region string) ([]Account, error) {
	ssoClient, err := createSSOClient(ctx, region)
	if err != nil {
		return nil, err
	}

	var accounts []Account
	var nextToken *string

	for {
		output, err := ssoClient.ListAccounts(ctx, &sso.ListAccountsInput{
			AccessToken: aws.String(accessToken),
			NextToken:   nextToken,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to list accounts: %w", err)
		}

		for _, acc := range output.AccountList {
			accounts = append(accounts, Account{
				AccountId:   aws.ToString(acc.AccountId),
				AccountName: aws.ToString(acc.AccountName),
				EmailAddr:   aws.ToString(acc.EmailAddress),
			})
		}

		if output.NextToken == nil {
			break
		}
		nextToken = output.NextToken
	}

	return accounts, nil
}

// ListAccountRoles lists all roles for an account using native AWS SDK
func (c *SSOClient) ListAccountRoles(ctx context.Context, accessToken, accountId, region string) ([]AccountRole, error) {
	ssoClient, err := createSSOClient(ctx, region)
	if err != nil {
		return nil, err
	}

	var roles []AccountRole
	var nextToken *string

	for {
		output, err := ssoClient.ListAccountRoles(ctx, &sso.ListAccountRolesInput{
			AccessToken: aws.String(accessToken),
			AccountId:   aws.String(accountId),
			NextToken:   nextToken,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to list account roles: %w", err)
		}

		for _, role := range output.RoleList {
			roles = append(roles, AccountRole{
				RoleName:  aws.ToString(role.RoleName),
				AccountId: aws.ToString(role.AccountId),
			})
		}

		if output.NextToken == nil {
			break
		}
		nextToken = output.NextToken
	}

	return roles, nil
}

// GetRoleCredentials fetches temporary credentials for a role using native AWS SDK
// This is the "Leapp Secret" - we get the credentials directly without needing SSO config
func (c *SSOClient) GetRoleCredentials(ctx context.Context, accessToken, accountId, roleName, region string) (*RoleCredentials, error) {
	ssoClient, err := createSSOClient(ctx, region)
	if err != nil {
		return nil, err
	}

	output, err := ssoClient.GetRoleCredentials(ctx, &sso.GetRoleCredentialsInput{
		AccessToken: aws.String(accessToken),
		AccountId:   aws.String(accountId),
		RoleName:    aws.String(roleName),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get role credentials: %w", err)
	}

	creds := output.RoleCredentials
	expiration := time.UnixMilli(creds.Expiration)

	return &RoleCredentials{
		AccessKeyId:     aws.ToString(creds.AccessKeyId),
		SecretAccessKey: aws.ToString(creds.SecretAccessKey),
		SessionToken:    aws.ToString(creds.SessionToken),
		Expiration:      expiration,
	}, nil
}

// SyncSession fetches all accounts and roles for a session and stores them
func (c *SSOClient) SyncSession(ctx context.Context, sessionName, startUrl, region string) (*SSOSession, error) {
	// Get token for this session
	token, err := c.storage.GetToken(startUrl)
	if err != nil {
		return nil, fmt.Errorf("no valid token found: %w (please login first)", err)
	}

	if token.ExpiresAt.Before(time.Now()) {
		return nil, fmt.Errorf("token expired, please login again")
	}

	// List all accounts
	accounts, err := c.ListAccounts(ctx, token.AccessToken, region)
	if err != nil {
		return nil, fmt.Errorf("failed to list accounts: %w", err)
	}

	// For each account, list roles
	var accountsWithRoles []AccountWithRoles
	for _, acc := range accounts {
		roles, err := c.ListAccountRoles(ctx, token.AccessToken, acc.AccountId, region)
		if err != nil {
			log.Printf("Warning: failed to list roles for account %s: %v", acc.AccountId, err)
			continue
		}

		roleNames := make([]string, len(roles))
		for i, r := range roles {
			roleNames[i] = r.RoleName
		}

		accountsWithRoles = append(accountsWithRoles, AccountWithRoles{
			Account: acc,
			Roles:   roleNames,
		})
	}

	session := &SSOSession{
		Name:        sessionName,
		StartUrl:    startUrl,
		Region:      region,
		Accounts:    accountsWithRoles,
		LastSynced:  time.Now(),
		TokenExpiry: token.ExpiresAt,
	}

	// Store the session
	if err := c.storage.StoreSession(session); err != nil {
		return nil, fmt.Errorf("failed to store session: %w", err)
	}

	return session, nil
}

// GetSession retrieves a stored session
func (c *SSOClient) GetSession(sessionName string) (*SSOSession, error) {
	return c.storage.GetSession(sessionName)
}

// ListSessions lists all stored sessions
func (c *SSOClient) ListSessions() ([]SSOSession, error) {
	return c.storage.ListSessions()
}

// DeleteSession removes a stored session
func (c *SSOClient) DeleteSession(sessionName string) error {
	return c.storage.DeleteSession(sessionName)
}

// GenerateBridgeConfig generates a Bridge-managed AWS config file with STATIC credentials
// This is the "Leapp trick" - kubectl doesn't need to know about SSO at all!
func (c *SSOClient) GenerateBridgeConfig(ctx context.Context) error {
	sessions, err := c.ListSessions()
	if err != nil {
		return err
	}

	homeDir, _ := os.UserHomeDir()
	bridgeConfigDir := filepath.Join(homeDir, ".bridge", "aws")
	if err := os.MkdirAll(bridgeConfigDir, 0700); err != nil {
		return err
	}

	configPath := filepath.Join(bridgeConfigDir, "config")
	credentialsPath := filepath.Join(bridgeConfigDir, "credentials")

	var configContent strings.Builder
	var credentialsContent strings.Builder

	// Header comments
	configContent.WriteString("# Bridge-managed AWS config - DO NOT EDIT MANUALLY\n")
	configContent.WriteString("# This file is regenerated automatically\n\n")

	credentialsContent.WriteString("# Bridge-managed AWS credentials - DO NOT EDIT MANUALLY\n")
	credentialsContent.WriteString("# This file is regenerated automatically\n\n")

	for _, session := range sessions {
		// Get the token for this session
		token, err := c.storage.GetToken(session.StartUrl)
		if err != nil {
			log.Printf("Warning: no token for session %s, skipping credential generation", session.Name)
			continue
		}

		if token.ExpiresAt.Before(time.Now()) {
			log.Printf("Warning: token expired for session %s, skipping credential generation", session.Name)
			continue
		}

		// For each account/role, get credentials and write as static profile
		for _, acc := range session.Accounts {
			for _, role := range acc.Roles {
				profileName := fmt.Sprintf("bridge-%s-%s", sanitizeName(acc.AccountName), sanitizeName(role))

				// Get temporary credentials using the "Leapp secret"
				creds, err := c.GetRoleCredentials(ctx, token.AccessToken, acc.AccountId, role, session.Region)
				if err != nil {
					log.Printf("Warning: failed to get credentials for %s/%s: %v", acc.AccountName, role, err)
					continue
				}

				// Write config profile (just region)
				configContent.WriteString(fmt.Sprintf("[profile %s]\n", profileName))
				configContent.WriteString(fmt.Sprintf("region = %s\n", session.Region))
				configContent.WriteString(fmt.Sprintf("# Account: %s (%s)\n", acc.AccountName, acc.AccountId))
				configContent.WriteString(fmt.Sprintf("# Role: %s\n", role))
				configContent.WriteString(fmt.Sprintf("# Expires: %s\n", creds.Expiration.Format(time.RFC3339)))
				configContent.WriteString("\n")

				// Write credentials (the actual keys)
				credentialsContent.WriteString(fmt.Sprintf("[%s]\n", profileName))
				credentialsContent.WriteString(fmt.Sprintf("aws_access_key_id = %s\n", creds.AccessKeyId))
				credentialsContent.WriteString(fmt.Sprintf("aws_secret_access_key = %s\n", creds.SecretAccessKey))
				credentialsContent.WriteString(fmt.Sprintf("aws_session_token = %s\n", creds.SessionToken))
				credentialsContent.WriteString("\n")
			}
		}
	}

	// Write config file
	if err := os.WriteFile(configPath, []byte(configContent.String()), 0600); err != nil {
		return fmt.Errorf("failed to write config: %w", err)
	}

	// Write credentials file
	if err := os.WriteFile(credentialsPath, []byte(credentialsContent.String()), 0600); err != nil {
		return fmt.Errorf("failed to write credentials: %w", err)
	}

	return nil
}

// GenerateProfileCredentials generates credentials for a specific profile
// This is called on-demand when a user maps a context to a role
func (c *SSOClient) GenerateProfileCredentials(ctx context.Context, sessionName, accountId, roleName string) (*RoleCredentials, string, error) {
	session, err := c.storage.GetSession(sessionName)
	if err != nil {
		return nil, "", fmt.Errorf("session not found: %w", err)
	}

	token, err := c.storage.GetToken(session.StartUrl)
	if err != nil {
		return nil, "", fmt.Errorf("no valid token: %w (please login first)", err)
	}

	if token.ExpiresAt.Before(time.Now()) {
		return nil, "", fmt.Errorf("token expired, please login again")
	}

	// Find the account name for the profile name
	var accountName string
	for _, acc := range session.Accounts {
		if acc.AccountId == accountId {
			accountName = acc.AccountName
			break
		}
	}
	if accountName == "" {
		accountName = accountId
	}

	// Get credentials
	creds, err := c.GetRoleCredentials(ctx, token.AccessToken, accountId, roleName, session.Region)
	if err != nil {
		return nil, "", err
	}

	// Generate profile name
	profileName := fmt.Sprintf("bridge-%s-%s", sanitizeName(accountName), sanitizeName(roleName))

	// Write credentials to Bridge's managed files
	homeDir, _ := os.UserHomeDir()
	bridgeConfigDir := filepath.Join(homeDir, ".bridge", "aws")
	if err := os.MkdirAll(bridgeConfigDir, 0700); err != nil {
		return nil, "", err
	}

	// Append/update config
	configPath := filepath.Join(bridgeConfigDir, "config")
	configEntry := fmt.Sprintf("\n[profile %s]\nregion = %s\n# Account: %s (%s)\n# Role: %s\n# Expires: %s\n",
		profileName, session.Region, accountName, accountId, roleName, creds.Expiration.Format(time.RFC3339))

	// Read existing config
	existingConfig, _ := os.ReadFile(configPath)
	if !strings.Contains(string(existingConfig), fmt.Sprintf("[profile %s]", profileName)) {
		f, err := os.OpenFile(configPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
		if err != nil {
			return nil, "", err
		}
		defer f.Close()
		f.WriteString(configEntry)
	}

	// Append/update credentials
	credentialsPath := filepath.Join(bridgeConfigDir, "credentials")
	credEntry := fmt.Sprintf("\n[%s]\naws_access_key_id = %s\naws_secret_access_key = %s\naws_session_token = %s\n",
		profileName, creds.AccessKeyId, creds.SecretAccessKey, creds.SessionToken)

	// Read existing credentials and update
	existingCreds, _ := os.ReadFile(credentialsPath)
	credStr := string(existingCreds)

	// Remove existing entry if present
	if idx := strings.Index(credStr, fmt.Sprintf("[%s]", profileName)); idx >= 0 {
		// Find the end of this section (next [ or end of file)
		endIdx := strings.Index(credStr[idx+1:], "\n[")
		if endIdx == -1 {
			credStr = credStr[:idx]
		} else {
			credStr = credStr[:idx] + credStr[idx+1+endIdx+1:]
		}
	}

	// Append new entry
	credStr += credEntry

	if err := os.WriteFile(credentialsPath, []byte(credStr), 0600); err != nil {
		return nil, "", err
	}

	return creds, profileName, nil
}

// GetBridgeConfigPath returns the path to Bridge's managed AWS config
func GetBridgeConfigPath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ".bridge", "aws", "config")
}

// GetBridgeCredentialsPath returns the path to Bridge's managed AWS credentials
func GetBridgeCredentialsPath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ".bridge", "aws", "credentials")
}

// GetSessionStatus checks if a session has a valid token
func (c *SSOClient) GetSessionStatus(startUrl string) (*SessionStatus, error) {
	token, err := c.storage.GetToken(startUrl)

	status := &SessionStatus{
		StartUrl:   startUrl,
		IsLoggedIn: false,
	}

	if err != nil {
		return status, nil
	}

	status.IsLoggedIn = token.ExpiresAt.After(time.Now())
	status.TokenExpiry = token.ExpiresAt
	status.Region = token.Region

	return status, nil
}

// RefreshCredentialsForContext refreshes credentials for a mapped context
func (c *SSOClient) RefreshCredentialsForContext(ctx context.Context, contextName string) (*RoleCredentials, string, error) {
	mapping, err := c.storage.GetContextMapping(contextName)
	if err != nil {
		return nil, "", fmt.Errorf("no mapping found for context: %w", err)
	}

	return c.GenerateProfileCredentials(ctx, mapping.SessionName, mapping.AccountId, mapping.RoleName)
}

// Helper function to sanitize names for profile names
func sanitizeName(name string) string {
	result := make([]byte, 0, len(name))
	for i := 0; i < len(name); i++ {
		c := name[i]
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_' {
			if c >= 'A' && c <= 'Z' {
				c = c + 32 // lowercase
			}
			result = append(result, c)
		} else if c == ' ' {
			result = append(result, '-')
		}
	}
	return string(result)
}
