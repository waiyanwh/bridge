package eks

import (
	"testing"
)

func TestEncodeDecodeToken(t *testing.T) {
	// Sample presigned URL (simplified for testing)
	testURL := "https://sts.us-east-1.amazonaws.com/?Action=GetCallerIdentity&Version=2011-06-15&X-Amz-Algorithm=AWS4-HMAC-SHA256"

	// Encode it
	token := encodeToken(testURL)

	// Verify prefix
	if token[:len(tokenPrefix)] != tokenPrefix {
		t.Errorf("Token should start with %s, got %s", tokenPrefix, token[:len(tokenPrefix)])
	}

	// Decode it back
	decoded, err := DecodeToken(token)
	if err != nil {
		t.Fatalf("Failed to decode token: %v", err)
	}

	// Verify it matches
	if decoded != testURL {
		t.Errorf("Decoded URL doesn't match original.\nExpected: %s\nGot: %s", testURL, decoded)
	}
}

func TestValidateToken(t *testing.T) {
	tests := []struct {
		name    string
		token   string
		wantErr bool
	}{
		{
			name:    "invalid prefix",
			token:   "invalid-prefix.abc123",
			wantErr: true,
		},
		{
			name:    "empty payload",
			token:   tokenPrefix,
			wantErr: true,
		},
		{
			name:    "invalid base64",
			token:   tokenPrefix + "not-valid-base64!!!",
			wantErr: true,
		},
		{
			name:    "valid token format",
			token:   encodeToken("https://sts.us-east-1.amazonaws.com/?Action=GetCallerIdentity&Version=2011-06-15"),
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateToken(tt.token)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateToken() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestExtractClusterNameFromARN(t *testing.T) {
	tests := []struct {
		arn      string
		expected string
		wantErr  bool
	}{
		{
			arn:      "arn:aws:eks:us-east-1:123456789012:cluster/my-cluster",
			expected: "my-cluster",
			wantErr:  false,
		},
		{
			arn:      "arn:aws:eks:ap-southeast-1:123456789012:cluster/production-eks",
			expected: "production-eks",
			wantErr:  false,
		},
		{
			arn:      "invalid-arn",
			expected: "",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.arn, func(t *testing.T) {
			result, err := ExtractClusterNameFromARN(tt.arn)
			if (err != nil) != tt.wantErr {
				t.Errorf("ExtractClusterNameFromARN() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if result != tt.expected {
				t.Errorf("ExtractClusterNameFromARN() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestGetStsEndpoint(t *testing.T) {
	tests := []struct {
		region   string
		expected string
	}{
		{"us-east-1", "https://sts.us-east-1.amazonaws.com/"},
		{"eu-west-1", "https://sts.eu-west-1.amazonaws.com/"},
		{"cn-north-1", "https://sts.cn-north-1.amazonaws.com.cn/"},
		{"cn-northwest-1", "https://sts.cn-northwest-1.amazonaws.com.cn/"},
		{"us-gov-west-1", "https://sts.us-gov-west-1.amazonaws.com/"},
	}

	for _, tt := range tests {
		t.Run(tt.region, func(t *testing.T) {
			result := getStsEndpoint(tt.region)
			if result != tt.expected {
				t.Errorf("getStsEndpoint(%s) = %v, want %v", tt.region, result, tt.expected)
			}
		})
	}
}

