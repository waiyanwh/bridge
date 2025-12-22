package eks

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	v4 "github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	"github.com/aws/aws-sdk-go-v2/credentials"
)

const (
	// clusterIDHeader is the header used by EKS to identify the cluster
	clusterIDHeader = "x-k8s-aws-id"

	// tokenPrefix is prepended to the base64 encoded URL
	tokenPrefix = "k8s-aws-v1."

	// tokenExpiration is how long the presigned URL is valid (EKS uses 15 minutes max)
	tokenExpiration = 14 * time.Minute

	// presignedURLExpiration is the X-Amz-Expires value in seconds
	// AWS CLI uses 60 seconds, but we use a slightly longer value for reliability
	presignedURLExpiration = 60

	// stsService is the AWS service name for signing
	stsService = "sts"

	// emptyPayloadHash is the SHA256 hash of an empty string
	emptyPayloadHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
)

// TokenGenerator generates EKS authentication tokens
type TokenGenerator struct{}

// NewTokenGenerator creates a new EKS token generator
func NewTokenGenerator() *TokenGenerator {
	return &TokenGenerator{}
}

// Token represents an EKS authentication token
type Token struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expiresAt"`
}

// GetToken generates an EKS bearer token using provided AWS credentials
// This bypasses the need for aws-iam-authenticator binary
//
// ⚡️ CRITICAL: This function generates a presigned STS GetCallerIdentity URL that is:
// 1. Signed by the REGIONAL STS endpoint (e.g., sts.ap-southeast-1.amazonaws.com)
// 2. Contains the x-k8s-aws-id header with the exact cluster name
// 3. Base64-encoded with the k8s-aws-v1. prefix
func (g *TokenGenerator) GetToken(ctx context.Context, accessKeyID, secretAccessKey, sessionToken, clusterName, region string) (*Token, error) {
	if clusterName == "" {
		return nil, fmt.Errorf("cluster name is required")
	}
	if region == "" {
		return nil, fmt.Errorf("region is required")
	}
	if accessKeyID == "" || secretAccessKey == "" {
		return nil, fmt.Errorf("AWS credentials are required")
	}

	// ⚡️ FORCE REGIONAL ENDPOINT
	// EKS requires tokens signed by the regional STS endpoint, NOT the global endpoint
	stsEndpoint := getStsEndpoint(region)

	// Create the request for GetCallerIdentity
	// Using GET method as required by the presigned URL spec
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, stsEndpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set query parameters for GetCallerIdentity
	query := req.URL.Query()
	query.Set("Action", "GetCallerIdentity")
	query.Set("Version", "2011-06-15")
	// ⚡️ CRITICAL: Add X-Amz-Expires for presigned URL validity
	// Without this, the token will be rejected by EKS!
	// AWS CLI uses 60 seconds, which is sufficient for the token handshake
	query.Set("X-Amz-Expires", fmt.Sprintf("%d", presignedURLExpiration))
	req.URL.RawQuery = query.Encode()

	// ⚡️ CRITICAL: Add the x-k8s-aws-id header with the EXACT cluster name
	// This header MUST be included in the signature and match the cluster exactly
	// The EKS API server verifies this header against the cluster it's authenticating for
	req.Header.Set(clusterIDHeader, clusterName)

	// Set Host header explicitly to the regional endpoint host
	// This ensures the signature is bound to the regional endpoint
	req.Header.Set("Host", req.URL.Host)

	// Create AWS credentials
	creds := aws.Credentials{
		AccessKeyID:     accessKeyID,
		SecretAccessKey: secretAccessKey,
		SessionToken:    sessionToken,
	}

	// Sign the request using SigV4 presigning
	signer := v4.NewSigner()
	signingTime := time.Now().UTC()

	// ⚡️ PresignHTTP creates a presigned URL that includes:
	// - X-Amz-Algorithm: AWS4-HMAC-SHA256
	// - X-Amz-Credential: <accessKey>/<date>/<region>/sts/aws4_request
	// - X-Amz-Date: <timestamp>
	// - X-Amz-SignedHeaders: host;x-k8s-aws-id (includes our cluster ID header!)
	// - X-Amz-Signature: <signature>
	// - X-Amz-Security-Token: <sessionToken> (if present)
	presignedURL, signedHeaders, err := signer.PresignHTTP(
		ctx,
		creds,
		req,
		emptyPayloadHash,
		stsService,
		region,
		signingTime,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to presign request: %w", err)
	}

	// Verify that our x-k8s-aws-id header was included in the signed headers
	// signedHeaders is http.Header (map[string][]string) - iterate over keys
	// This is critical - if it's not signed, the token will be rejected
	hasClusterHeader := false
	signedHeaderNames := make([]string, 0, len(signedHeaders))
	for headerName := range signedHeaders {
		signedHeaderNames = append(signedHeaderNames, headerName)
		if strings.EqualFold(headerName, clusterIDHeader) {
			hasClusterHeader = true
		}
	}
	if !hasClusterHeader {
		return nil, fmt.Errorf("critical error: %s header was not included in signature (signed headers: %v)", clusterIDHeader, signedHeaderNames)
	}

	// Encode the presigned URL to create the token
	token := encodeToken(presignedURL)

	expiresAt := signingTime.Add(tokenExpiration)

	return &Token{
		Token:     token,
		ExpiresAt: expiresAt,
	}, nil
}

// GetTokenWithConfig generates an EKS bearer token using an AWS config
func (g *TokenGenerator) GetTokenWithConfig(ctx context.Context, cfg aws.Config, clusterName string) (*Token, error) {
	if clusterName == "" {
		return nil, fmt.Errorf("cluster name is required")
	}

	// Get credentials from config
	creds, err := cfg.Credentials.Retrieve(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve credentials: %w", err)
	}

	return g.GetToken(ctx, creds.AccessKeyID, creds.SecretAccessKey, creds.SessionToken, clusterName, cfg.Region)
}

// GetTokenFromBridgeCredentials generates an EKS token using credentials stored by Bridge
// This is specifically for use with Bridge's isolated SSO credential management
func GetTokenFromBridgeCredentials(ctx context.Context, accessKeyID, secretAccessKey, sessionToken, clusterName, region string) (*Token, error) {
	gen := NewTokenGenerator()
	return gen.GetToken(ctx, accessKeyID, secretAccessKey, sessionToken, clusterName, region)
}

// GetTokenWithStaticCredentials is a convenience method for creating tokens with static credentials
func GetTokenWithStaticCredentials(ctx context.Context, accessKeyID, secretAccessKey, sessionToken, clusterName, region string) (*Token, error) {
	// Create config with static credentials
	creds := credentials.NewStaticCredentialsProvider(accessKeyID, secretAccessKey, sessionToken)
	cfg := aws.Config{
		Region:      region,
		Credentials: creds,
	}

	gen := NewTokenGenerator()
	return gen.GetTokenWithConfig(ctx, cfg, clusterName)
}

// getStsEndpoint returns the correct REGIONAL STS endpoint for a given region
// ⚡️ CRITICAL: EKS requires regional endpoints, NOT the global sts.amazonaws.com
// The token MUST be signed by the regional endpoint (e.g., sts.ap-southeast-1.amazonaws.com)
// ⚡️ NOTE: The trailing slash is REQUIRED - without it, the presigned URL won't work!
func getStsEndpoint(region string) string {
	// China regions
	if strings.HasPrefix(region, "cn-") {
		return fmt.Sprintf("https://sts.%s.amazonaws.com.cn/", region)
	}

	// GovCloud regions
	if strings.HasPrefix(region, "us-gov-") {
		return fmt.Sprintf("https://sts.%s.amazonaws.com/", region)
	}

	// ISO regions
	if strings.HasPrefix(region, "us-iso-") {
		return fmt.Sprintf("https://sts.%s.c2s.ic.gov/", region)
	}

	// ISO-B regions
	if strings.HasPrefix(region, "us-isob-") {
		return fmt.Sprintf("https://sts.%s.sc2s.sgov.gov/", region)
	}

	// ⚡️ Standard regions - MUST use regional endpoint for EKS authentication
	// The presigned URL will be signed with "sts.{region}.amazonaws.com" as the host
	// The trailing slash is REQUIRED for the presigned URL to work with EKS!
	return fmt.Sprintf("https://sts.%s.amazonaws.com/", region)
}

// encodeToken creates the EKS token from a presigned URL
func encodeToken(presignedURL string) string {
	// Base64 encode the URL using URL-safe encoding without padding
	// This is the exact format that EKS expects
	encoded := base64.RawURLEncoding.EncodeToString([]byte(presignedURL))

	// Prepend the token prefix
	return tokenPrefix + encoded
}

// DecodeToken decodes an EKS token back to the presigned URL (useful for debugging)
func DecodeToken(token string) (string, error) {
	if !strings.HasPrefix(token, tokenPrefix) {
		return "", fmt.Errorf("invalid token prefix")
	}

	encoded := strings.TrimPrefix(token, tokenPrefix)

	decoded, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return "", fmt.Errorf("failed to decode token: %w", err)
	}

	return string(decoded), nil
}

// ValidateToken checks if a token is properly formatted and uses regional endpoints
func ValidateToken(token string) error {
	if !strings.HasPrefix(token, tokenPrefix) {
		return fmt.Errorf("token must start with %s", tokenPrefix)
	}

	encoded := strings.TrimPrefix(token, tokenPrefix)
	if len(encoded) == 0 {
		return fmt.Errorf("token payload is empty")
	}

	// Try to decode to validate base64
	decoded, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return fmt.Errorf("invalid base64 encoding: %w", err)
	}

	// Validate it's a URL
	parsedURL, err := url.Parse(string(decoded))
	if err != nil {
		return fmt.Errorf("decoded token is not a valid URL: %w", err)
	}

	// Check it's an STS URL
	if !strings.Contains(parsedURL.Host, "sts") {
		return fmt.Errorf("token URL is not an STS endpoint")
	}

	// ⚡️ Verify it's a REGIONAL endpoint, not the global endpoint
	// Global endpoint (sts.amazonaws.com) will NOT work with EKS!
	if parsedURL.Host == "sts.amazonaws.com" {
		return fmt.Errorf("token uses global STS endpoint (sts.amazonaws.com) - EKS requires regional endpoints like sts.{region}.amazonaws.com")
	}

	// Check for required query parameters
	query := parsedURL.Query()
	if query.Get("Action") != "GetCallerIdentity" {
		return fmt.Errorf("token URL missing GetCallerIdentity action")
	}

	// Verify x-k8s-aws-id header is in the signed headers
	signedHeaders := query.Get("X-Amz-SignedHeaders")
	if signedHeaders == "" {
		return fmt.Errorf("token URL missing X-Amz-SignedHeaders parameter")
	}
	if !strings.Contains(strings.ToLower(signedHeaders), strings.ToLower(clusterIDHeader)) {
		return fmt.Errorf("token URL does not include %s in signed headers - this token will be rejected by EKS", clusterIDHeader)
	}

	return nil
}

// GetTokenRegion extracts the AWS region from a token (useful for debugging)
func GetTokenRegion(token string) (string, error) {
	decoded, err := DecodeToken(token)
	if err != nil {
		return "", err
	}

	parsedURL, err := url.Parse(decoded)
	if err != nil {
		return "", fmt.Errorf("failed to parse URL: %w", err)
	}

	// Extract region from host: sts.{region}.amazonaws.com
	host := parsedURL.Host
	parts := strings.Split(host, ".")
	if len(parts) >= 2 && parts[0] == "sts" {
		return parts[1], nil
	}

	return "", fmt.Errorf("could not extract region from host: %s", host)
}

// GetTokenClusterID extracts the cluster ID from the signed headers in a token (useful for debugging)
func GetTokenClusterID(token string) (string, error) {
	decoded, err := DecodeToken(token)
	if err != nil {
		return "", err
	}

	parsedURL, err := url.Parse(decoded)
	if err != nil {
		return "", fmt.Errorf("failed to parse URL: %w", err)
	}

	// The cluster ID is in the x-k8s-aws-id header value, which is URL-encoded in the query string
	// Look for X-Amz-SignedHeaders to confirm it's signed
	query := parsedURL.Query()
	signedHeaders := query.Get("X-Amz-SignedHeaders")
	if !strings.Contains(strings.ToLower(signedHeaders), strings.ToLower(clusterIDHeader)) {
		return "", fmt.Errorf("%s header not found in signed headers", clusterIDHeader)
	}

	// Unfortunately, the actual cluster ID value isn't in the presigned URL query string
	// It was in the original request header. We can only verify it was signed.
	return "", fmt.Errorf("cluster ID was signed but not extractable from presigned URL (this is expected)")
}

// IsTokenExpired checks if a token has expired based on a given expiration time
func IsTokenExpired(expiresAt time.Time) bool {
	// Add a small buffer (30 seconds) to avoid using tokens that are about to expire
	return time.Now().Add(30 * time.Second).After(expiresAt)
}

// GenerateTokenForContext generates an EKS token for a Bridge context mapping
// This is the main entry point used by the kubeconfig injector
func GenerateTokenForContext(ctx context.Context, accessKeyID, secretAccessKey, sessionToken, clusterName, region string) (string, time.Time, error) {
	gen := NewTokenGenerator()
	token, err := gen.GetToken(ctx, accessKeyID, secretAccessKey, sessionToken, clusterName, region)
	if err != nil {
		return "", time.Time{}, err
	}
	return token.Token, token.ExpiresAt, nil
}

// ExtractClusterNameFromARN extracts the cluster name from an EKS cluster ARN
// ARN format: arn:aws:eks:region:account:cluster/cluster-name
func ExtractClusterNameFromARN(arn string) (string, error) {
	parts := strings.Split(arn, "/")
	if len(parts) < 2 {
		return "", fmt.Errorf("invalid EKS cluster ARN format")
	}
	return parts[len(parts)-1], nil
}
