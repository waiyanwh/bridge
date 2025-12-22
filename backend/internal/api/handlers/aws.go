package handlers

import (
	"bufio"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/waiyan/bridge/internal/k8s"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/clientcmd/api"
)

// AWSHandler handles AWS-related API requests
type AWSHandler struct {
	k8sService *k8s.Service
}

// NewAWSHandler creates a new AWSHandler
func NewAWSHandler(k8sService *k8s.Service) *AWSHandler {
	return &AWSHandler{
		k8sService: k8sService,
	}
}

// AWSProfilesResponse represents the response for listing AWS profiles
type AWSProfilesResponse struct {
	Profiles []string `json:"profiles"`
	Count    int      `json:"count"`
}

// SetAWSProfileRequest represents the request to set an AWS profile for a context
type SetAWSProfileRequest struct {
	ContextName string `json:"contextName" binding:"required"`
	AWSProfile  string `json:"awsProfile" binding:"required"`
}

// ContextAWSMapping represents a context with its AWS profile mapping
type ContextAWSMapping struct {
	ContextName string `json:"contextName"`
	ClusterName string `json:"clusterName"`
	UserName    string `json:"userName"`
	AWSProfile  string `json:"awsProfile"`
}

// ContextAWSMappingsResponse represents the response for listing context AWS mappings
type ContextAWSMappingsResponse struct {
	Mappings []ContextAWSMapping `json:"mappings"`
	Count    int                 `json:"count"`
}

// ListAWSProfiles handles GET /api/v1/aws/profiles
// Reads AWS config file and extracts profile names
func (h *AWSHandler) ListAWSProfiles(c *gin.Context) {
	profiles, err := parseAWSProfiles()
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "PARSE_AWS_CONFIG_FAILED",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, AWSProfilesResponse{
		Profiles: profiles,
		Count:    len(profiles),
	})
}

// SetContextAWSProfile handles POST /api/v1/system/context/aws-profile
// Sets the AWS_PROFILE environment variable in the kubeconfig exec config
func (h *AWSHandler) SetContextAWSProfile(c *gin.Context) {
	var req SetAWSProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: err.Error(),
		})
		return
	}

	kubeconfigPath := getKubeconfigPath()

	// Create backup before modifying
	if err := createBackup(kubeconfigPath); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "BACKUP_FAILED",
			Message: fmt.Sprintf("Failed to create kubeconfig backup: %v", err),
		})
		return
	}

	// Load kubeconfig
	config, err := clientcmd.LoadFromFile(kubeconfigPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "LOAD_KUBECONFIG_FAILED",
			Message: err.Error(),
		})
		return
	}

	// Find the context
	ctx, exists := config.Contexts[req.ContextName]
	if !exists {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "CONTEXT_NOT_FOUND",
			Message: fmt.Sprintf("Context '%s' not found in kubeconfig", req.ContextName),
		})
		return
	}

	// Find the user associated with the context
	userName := ctx.AuthInfo
	user, exists := config.AuthInfos[userName]
	if !exists {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "USER_NOT_FOUND",
			Message: fmt.Sprintf("User '%s' not found in kubeconfig", userName),
		})
		return
	}

	// Check if this user has exec config (like aws eks get-token)
	if user.Exec == nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "NO_EXEC_CONFIG",
			Message: fmt.Sprintf("User '%s' does not have an exec config. AWS profile mapping only works with EKS clusters using aws-cli authentication.", userName),
		})
		return
	}

	// Update or add AWS_PROFILE env var
	updated := false
	for i, env := range user.Exec.Env {
		if env.Name == "AWS_PROFILE" {
			user.Exec.Env[i].Value = req.AWSProfile
			updated = true
			break
		}
	}

	if !updated {
		user.Exec.Env = append(user.Exec.Env, api.ExecEnvVar{
			Name:  "AWS_PROFILE",
			Value: req.AWSProfile,
		})
	}

	// Write the config back
	if err := clientcmd.WriteToFile(*config, kubeconfigPath); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "WRITE_KUBECONFIG_FAILED",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"message":     fmt.Sprintf("AWS profile '%s' set for context '%s'", req.AWSProfile, req.ContextName),
		"contextName": req.ContextName,
		"awsProfile":  req.AWSProfile,
	})
}

// ListContextAWSMappings handles GET /api/v1/system/context/aws-mappings
// Returns all contexts with their current AWS profile mappings
func (h *AWSHandler) ListContextAWSMappings(c *gin.Context) {
	kubeconfigPath := getKubeconfigPath()

	config, err := clientcmd.LoadFromFile(kubeconfigPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "LOAD_KUBECONFIG_FAILED",
			Message: err.Error(),
		})
		return
	}

	mappings := make([]ContextAWSMapping, 0, len(config.Contexts))

	for contextName, ctx := range config.Contexts {
		mapping := ContextAWSMapping{
			ContextName: contextName,
			ClusterName: ctx.Cluster,
			UserName:    ctx.AuthInfo,
			AWSProfile:  "",
		}

		// Check if user has AWS_PROFILE set in exec config
		if user, exists := config.AuthInfos[ctx.AuthInfo]; exists && user.Exec != nil {
			for _, env := range user.Exec.Env {
				if env.Name == "AWS_PROFILE" {
					mapping.AWSProfile = env.Value
					break
				}
			}
		}

		mappings = append(mappings, mapping)
	}

	c.JSON(http.StatusOK, ContextAWSMappingsResponse{
		Mappings: mappings,
		Count:    len(mappings),
	})
}

// SSOLogin handles POST /api/v1/aws/sso-login
// Triggers aws sso login for the specified profile
func (h *AWSHandler) SSOLogin(c *gin.Context) {
	var req struct {
		Profile string `json:"profile" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: err.Error(),
		})
		return
	}

	// Run aws sso login in the background
	// This will open a browser for the user to authenticate
	cmd := exec.Command("aws", "sso", "login", "--profile", req.Profile)

	// Start the command without waiting
	if err := cmd.Start(); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "SSO_LOGIN_FAILED",
			Message: fmt.Sprintf("Failed to start SSO login: %v", err),
		})
		return
	}

	// Don't wait for the command to complete - it will open a browser
	go func() {
		_ = cmd.Wait()
	}()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("SSO login initiated for profile '%s'. A browser window should open for authentication.", req.Profile),
		"profile": req.Profile,
	})
}

// parseAWSProfiles reads the AWS config file and extracts profile names
func parseAWSProfiles() ([]string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get home directory: %w", err)
	}

	configPath := filepath.Join(homeDir, ".aws", "config")
	credentialsPath := filepath.Join(homeDir, ".aws", "credentials")

	profiles := make(map[string]bool)

	// Parse config file
	if err := parseAWSConfigFile(configPath, profiles, true); err != nil && !os.IsNotExist(err) {
		return nil, err
	}

	// Parse credentials file
	if err := parseAWSConfigFile(credentialsPath, profiles, false); err != nil && !os.IsNotExist(err) {
		return nil, err
	}

	// Convert map to slice
	result := make([]string, 0, len(profiles))
	for profile := range profiles {
		result = append(result, profile)
	}

	return result, nil
}

// parseAWSConfigFile parses an AWS config or credentials file
func parseAWSConfigFile(path string, profiles map[string]bool, isConfigFile bool) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	// Regex patterns for section headers
	// Config file: [profile name] or [default]
	// Credentials file: [name]
	profileRegex := regexp.MustCompile(`^\[profile\s+(.+)\]$`)
	defaultRegex := regexp.MustCompile(`^\[default\]$`)
	credentialsRegex := regexp.MustCompile(`^\[(.+)\]$`)

	reader := bufio.NewReader(file)
	for {
		line, err := reader.ReadString('\n')
		if err != nil && err != io.EOF {
			return err
		}

		line = strings.TrimSpace(line)

		if isConfigFile {
			// Check for [profile name] pattern
			if matches := profileRegex.FindStringSubmatch(line); len(matches) > 1 {
				profiles[matches[1]] = true
			}
			// Check for [default]
			if defaultRegex.MatchString(line) {
				profiles["default"] = true
			}
		} else {
			// Credentials file uses [name] format directly
			if matches := credentialsRegex.FindStringSubmatch(line); len(matches) > 1 {
				profiles[matches[1]] = true
			}
		}

		if err == io.EOF {
			break
		}
	}

	return nil
}

// getKubeconfigPath returns the path to the kubeconfig file
func getKubeconfigPath() string {
	if kubeconfig := os.Getenv("KUBECONFIG"); kubeconfig != "" {
		return kubeconfig
	}

	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ".kube", "config")
}

// createBackup creates a backup of the kubeconfig file
func createBackup(kubeconfigPath string) error {
	// Read original file
	data, err := os.ReadFile(kubeconfigPath)
	if err != nil {
		return err
	}

	// Create backup with timestamp
	backupPath := fmt.Sprintf("%s.bak.%s", kubeconfigPath, time.Now().Format("20060102-150405"))

	// On Windows, we might need different permissions
	perm := os.FileMode(0600)
	if runtime.GOOS == "windows" {
		perm = 0644
	}

	return os.WriteFile(backupPath, data, perm)
}

// ================== SSO Sync Types ==================

// SSOSyncRequest represents the request to sync AWS SSO accounts
type SSOSyncRequest struct {
	SSOStartURL     string `json:"ssoStartUrl"`
	SSORegion       string `json:"ssoRegion"`
	SSOSessionName  string `json:"ssoSessionName"`
}

// SSOSyncResponse represents the response from SSO sync
type SSOSyncResponse struct {
	Success       bool     `json:"success"`
	Message       string   `json:"message"`
	NewProfiles   int      `json:"newProfiles"`
	TotalAccounts int      `json:"totalAccounts"`
	TotalRoles    int      `json:"totalRoles"`
	Profiles      []string `json:"profiles"`
}

// SSOSessionInfo represents an SSO session from config
type SSOSessionInfo struct {
	Name      string `json:"name"`
	StartURL  string `json:"startUrl"`
	Region    string `json:"region"`
}

// SSOSessionsResponse represents the response for listing SSO sessions
type SSOSessionsResponse struct {
	Sessions []SSOSessionInfo `json:"sessions"`
	Count    int              `json:"count"`
}

// ssoTokenCache represents the cached SSO token
type ssoTokenCache struct {
	AccessToken string    `json:"accessToken"`
	ExpiresAt   time.Time `json:"expiresAt"`
	Region      string    `json:"region"`
	StartURL    string    `json:"startUrl"`
}

// awsAccount represents an AWS account from SSO
type awsAccount struct {
	AccountID   string `json:"accountId"`
	AccountName string `json:"accountName"`
	EmailAddr   string `json:"emailAddress"`
}

// awsAccountRole represents a role in an AWS account
type awsAccountRole struct {
	RoleName  string `json:"roleName"`
	AccountID string `json:"accountId"`
}

// ListSSOSessions handles GET /api/v1/aws/sso/sessions
// Returns all SSO sessions found in ~/.aws/config
func (h *AWSHandler) ListSSOSessions(c *gin.Context) {
	sessions, err := parseSSOSessions()
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "PARSE_SSO_SESSIONS_FAILED",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, SSOSessionsResponse{
		Sessions: sessions,
		Count:    len(sessions),
	})
}

// SyncSSOAccounts handles POST /api/v1/aws/sso/sync
// Discovers AWS SSO accounts and roles, then appends them to ~/.aws/config
func (h *AWSHandler) SyncSSOAccounts(c *gin.Context) {
	var req SSOSyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Try to use defaults from existing sessions
		sessions, _ := parseSSOSessions()
		if len(sessions) == 0 {
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Error:   "INVALID_REQUEST",
				Message: "No SSO session info provided and no existing sessions found in config",
			})
			return
		}
		// Use the first session as default
		req.SSOStartURL = sessions[0].StartURL
		req.SSORegion = sessions[0].Region
		req.SSOSessionName = sessions[0].Name
	}

	// Validate required fields
	if req.SSOStartURL == "" || req.SSORegion == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: "ssoStartUrl and ssoRegion are required",
		})
		return
	}

	// If session name is empty, generate one
	if req.SSOSessionName == "" {
		req.SSOSessionName = "bridge-sso"
	}

	// Step 1: Get Access Token from cache
	accessToken, err := getSSOAccessToken(req.SSOStartURL, req.SSORegion)
	if err != nil {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:   "SSO_LOGIN_REQUIRED",
			Message: fmt.Sprintf("SSO login required: %v. Please login first using 'aws sso login'.", err),
		})
		return
	}

	// Step 2: Fetch all accounts
	accounts, err := listSSOAccounts(accessToken, req.SSORegion)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "LIST_ACCOUNTS_FAILED",
			Message: err.Error(),
		})
		return
	}

	if len(accounts) == 0 {
		c.JSON(http.StatusOK, SSOSyncResponse{
			Success:       true,
			Message:       "No accounts found for this SSO session",
			NewProfiles:   0,
			TotalAccounts: 0,
			TotalRoles:    0,
			Profiles:      []string{},
		})
		return
	}

	// Step 3: Fetch roles for each account
	type accountRole struct {
		Account awsAccount
		Role    awsAccountRole
	}
	var allRoles []accountRole

	for _, account := range accounts {
		roles, err := listAccountRoles(accessToken, account.AccountID, req.SSORegion)
		if err != nil {
			// Log but continue with other accounts
			continue
		}
		for _, role := range roles {
			allRoles = append(allRoles, accountRole{Account: account, Role: role})
		}
	}

	// Step 4: Generate and append profiles to config
	homeDir, _ := os.UserHomeDir()
	configPath := filepath.Join(homeDir, ".aws", "config")

	// Create backup before modifying
	if err := createAWSConfigBackup(configPath); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "BACKUP_FAILED",
			Message: fmt.Sprintf("Failed to create config backup: %v", err),
		})
		return
	}

	// Read existing config to check for existing profiles
	existingProfiles := make(map[string]bool)
	if profiles, _ := parseAWSProfiles(); profiles != nil {
		for _, p := range profiles {
			existingProfiles[p] = true
		}
	}

	// Ensure sso-session exists in config
	if err := ensureSSOSession(configPath, req.SSOSessionName, req.SSOStartURL, req.SSORegion); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "UPDATE_CONFIG_FAILED",
			Message: fmt.Sprintf("Failed to add SSO session: %v", err),
		})
		return
	}

	// Generate new profiles
	var newProfiles []string
	for _, ar := range allRoles {
		profileName := generateProfileName(ar.Account.AccountName, ar.Role.RoleName)
		
		if existingProfiles[profileName] {
			continue // Skip existing profiles
		}

		if err := appendProfile(configPath, profileName, req.SSOSessionName, ar.Account.AccountID, ar.Role.RoleName, req.SSORegion); err != nil {
			// Log but continue
			continue
		}
		newProfiles = append(newProfiles, profileName)
	}

	c.JSON(http.StatusOK, SSOSyncResponse{
		Success:       true,
		Message:       fmt.Sprintf("Successfully synced %d new profiles from %d accounts", len(newProfiles), len(accounts)),
		NewProfiles:   len(newProfiles),
		TotalAccounts: len(accounts),
		TotalRoles:    len(allRoles),
		Profiles:      newProfiles,
	})
}

// parseSSOSessions reads AWS config and extracts sso-session blocks
func parseSSOSessions() ([]SSOSessionInfo, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}

	configPath := filepath.Join(homeDir, ".aws", "config")
	file, err := os.Open(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			return []SSOSessionInfo{}, nil
		}
		return nil, err
	}
	defer file.Close()

	var sessions []SSOSessionInfo
	var currentSession *SSOSessionInfo

	ssoSessionRegex := regexp.MustCompile(`^\[sso-session\s+(.+)\]$`)

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		// Check for new section
		if strings.HasPrefix(line, "[") {
			// Save previous session if exists
			if currentSession != nil && currentSession.StartURL != "" {
				sessions = append(sessions, *currentSession)
			}
			currentSession = nil

			// Check if it's an sso-session
			if matches := ssoSessionRegex.FindStringSubmatch(line); len(matches) > 1 {
				currentSession = &SSOSessionInfo{Name: matches[1]}
			}
			continue
		}

		// Parse key-value pairs for current session
		if currentSession != nil && strings.Contains(line, "=") {
			parts := strings.SplitN(line, "=", 2)
			key := strings.TrimSpace(parts[0])
			value := strings.TrimSpace(parts[1])

			switch key {
			case "sso_start_url":
				currentSession.StartURL = value
			case "sso_region":
				currentSession.Region = value
			}
		}
	}

	// Save last session
	if currentSession != nil && currentSession.StartURL != "" {
		sessions = append(sessions, *currentSession)
	}

	return sessions, scanner.Err()
}

// getSSOAccessToken retrieves a valid SSO access token from cache
func getSSOAccessToken(startURL, region string) (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}

	ssoCachePath := filepath.Join(homeDir, ".aws", "sso", "cache")
	
	// List all cache files
	entries, err := os.ReadDir(ssoCachePath)
	if err != nil {
		return "", fmt.Errorf("no SSO cache found: %w", err)
	}

	// The cache file name is a SHA1 hash of the startURL
	expectedHash := sha1.Sum([]byte(startURL))
	expectedFileName := hex.EncodeToString(expectedHash[:]) + ".json"

	var tokenFile string
	for _, entry := range entries {
		if entry.Name() == expectedFileName {
			tokenFile = filepath.Join(ssoCachePath, entry.Name())
			break
		}
	}

	// If exact match not found, try all cache files
	if tokenFile == "" {
		for _, entry := range entries {
			if !strings.HasSuffix(entry.Name(), ".json") {
				continue
			}
			
			filePath := filepath.Join(ssoCachePath, entry.Name())
			data, err := os.ReadFile(filePath)
			if err != nil {
				continue
			}

			var cache ssoTokenCache
			if err := json.Unmarshal(data, &cache); err != nil {
				continue
			}

			// Check if this cache matches our startURL
			if cache.StartURL == startURL && cache.AccessToken != "" {
				tokenFile = filePath
				break
			}
		}
	}

	if tokenFile == "" {
		return "", fmt.Errorf("no cached token found for %s", startURL)
	}

	// Read and parse the token file
	data, err := os.ReadFile(tokenFile)
	if err != nil {
		return "", err
	}

	var cache ssoTokenCache
	if err := json.Unmarshal(data, &cache); err != nil {
		return "", err
	}

	// Check if token is expired
	if cache.ExpiresAt.Before(time.Now()) {
		return "", fmt.Errorf("SSO token expired at %v", cache.ExpiresAt)
	}

	return cache.AccessToken, nil
}

// listSSOAccounts uses AWS CLI to list SSO accounts
func listSSOAccounts(accessToken, region string) ([]awsAccount, error) {
	cmd := exec.Command("aws", "sso", "list-accounts",
		"--access-token", accessToken,
		"--region", region,
		"--output", "json")

	output, err := cmd.Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			return nil, fmt.Errorf("aws sso list-accounts failed: %s", string(exitErr.Stderr))
		}
		return nil, err
	}

	var result struct {
		AccountList []awsAccount `json:"accountList"`
	}
	if err := json.Unmarshal(output, &result); err != nil {
		return nil, err
	}

	return result.AccountList, nil
}

// listAccountRoles uses AWS CLI to list roles for an account
func listAccountRoles(accessToken, accountID, region string) ([]awsAccountRole, error) {
	cmd := exec.Command("aws", "sso", "list-account-roles",
		"--access-token", accessToken,
		"--account-id", accountID,
		"--region", region,
		"--output", "json")

	output, err := cmd.Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			return nil, fmt.Errorf("aws sso list-account-roles failed: %s", string(exitErr.Stderr))
		}
		return nil, err
	}

	var result struct {
		RoleList []awsAccountRole `json:"roleList"`
	}
	if err := json.Unmarshal(output, &result); err != nil {
		return nil, err
	}

	return result.RoleList, nil
}

// generateProfileName creates a sanitized profile name from account and role
func generateProfileName(accountName, roleName string) string {
	// Sanitize account name: lowercase, replace spaces with dashes
	name := strings.ToLower(accountName)
	name = strings.ReplaceAll(name, " ", "-")
	name = regexp.MustCompile(`[^a-z0-9-]`).ReplaceAllString(name, "")
	
	// Sanitize role name
	role := strings.ToLower(roleName)
	role = strings.ReplaceAll(role, " ", "-")
	role = regexp.MustCompile(`[^a-z0-9-]`).ReplaceAllString(role, "")

	return fmt.Sprintf("%s-%s", name, role)
}

// createAWSConfigBackup creates a backup of the AWS config file
func createAWSConfigBackup(configPath string) error {
	data, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // No file to backup
		}
		return err
	}

	backupPath := fmt.Sprintf("%s.bak.%s", configPath, time.Now().Format("20060102-150405"))
	return os.WriteFile(backupPath, data, 0600)
}

// ensureSSOSession ensures the sso-session block exists in config
func ensureSSOSession(configPath, sessionName, startURL, region string) error {
	// Read existing config
	data, err := os.ReadFile(configPath)
	if err != nil && !os.IsNotExist(err) {
		return err
	}

	content := string(data)

	// Check if session already exists
	sessionHeader := fmt.Sprintf("[sso-session %s]", sessionName)
	if strings.Contains(content, sessionHeader) {
		return nil // Already exists
	}

	// Append new session
	sessionBlock := fmt.Sprintf("\n%s\nsso_start_url = %s\nsso_region = %s\n",
		sessionHeader, startURL, region)

	f, err := os.OpenFile(configPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = f.WriteString(sessionBlock)
	return err
}

// appendProfile appends a new profile to the AWS config
func appendProfile(configPath, profileName, ssoSession, accountID, roleName, region string) error {
	profileBlock := fmt.Sprintf("\n[profile %s]\nsso_session = %s\nsso_account_id = %s\nsso_role_name = %s\nregion = %s\n",
		profileName, ssoSession, accountID, roleName, region)

	f, err := os.OpenFile(configPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = f.WriteString(profileBlock)
	return err
}

// SSOLoginWithSession handles POST /api/v1/aws/sso/login
// Triggers aws sso login for a specific session
func (h *AWSHandler) SSOLoginWithSession(c *gin.Context) {
	var req struct {
		SessionName string `json:"sessionName"`
		StartURL    string `json:"startUrl"`
		Region      string `json:"region"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: err.Error(),
		})
		return
	}

	// If we have a session name, use --sso-session flag
	var cmd *exec.Cmd
	if req.SessionName != "" {
		cmd = exec.Command("aws", "sso", "login", "--sso-session", req.SessionName)
	} else if req.StartURL != "" && req.Region != "" {
		// Create a temporary profile for login
		homeDir, _ := os.UserHomeDir()
		configPath := filepath.Join(homeDir, ".aws", "config")
		
		// Ensure we have an sso-session to use
		sessionName := "bridge-temp-session"
		if err := ensureSSOSession(configPath, sessionName, req.StartURL, req.Region); err != nil {
			c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error:   "CREATE_SESSION_FAILED",
				Message: err.Error(),
			})
			return
		}
		cmd = exec.Command("aws", "sso", "login", "--sso-session", sessionName)
	} else {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Message: "Either sessionName or both startUrl and region are required",
		})
		return
	}

	// Start the command without waiting
	if err := cmd.Start(); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "SSO_LOGIN_FAILED",
			Message: fmt.Sprintf("Failed to start SSO login: %v", err),
		})
		return
	}

	// Don't wait for the command to complete
	go func() {
		_ = cmd.Wait()
	}()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "SSO login initiated. A browser window should open for authentication.",
	})
}

// init is used for any package-level initialization
func init() {
	// Ensure sort is used (for future profile sorting if needed)
	_ = sort.Strings
}

