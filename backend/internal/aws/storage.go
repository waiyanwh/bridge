package aws

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Storage handles persistent storage for SSO tokens and sessions
type Storage struct {
	mu       sync.RWMutex
	basePath string
}

// NewStorage creates a new storage instance
func NewStorage() *Storage {
	homeDir, _ := os.UserHomeDir()
	basePath := filepath.Join(homeDir, ".bridge")
	return &Storage{basePath: basePath}
}

// ensureDir creates the directory if it doesn't exist
func (s *Storage) ensureDir(path string) error {
	return os.MkdirAll(path, 0700)
}

// tokensDir returns the path to the tokens directory
func (s *Storage) tokensDir() string {
	return filepath.Join(s.basePath, "tokens")
}

// sessionsDir returns the path to the sessions directory
func (s *Storage) sessionsDir() string {
	return filepath.Join(s.basePath, "sessions")
}

// pendingAuthDir returns the path to pending auth directory
func (s *Storage) pendingAuthDir() string {
	return filepath.Join(s.basePath, "pending")
}

// hashStartUrl creates a filename-safe hash of the start URL
func hashStartUrl(startUrl string) string {
	h := sha256.Sum256([]byte(startUrl))
	return hex.EncodeToString(h[:])[:16]
}

// StoreToken saves an access token
func (s *Storage) StoreToken(startUrl string, token *TokenResult) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	dir := s.tokensDir()
	if err := s.ensureDir(dir); err != nil {
		return err
	}

	filename := hashStartUrl(startUrl) + ".json"
	path := filepath.Join(dir, filename)

	data, err := json.MarshalIndent(token, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0600)
}

// GetToken retrieves an access token for a start URL
func (s *Storage) GetToken(startUrl string) (*TokenResult, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	filename := hashStartUrl(startUrl) + ".json"
	path := filepath.Join(s.tokensDir(), filename)

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var token TokenResult
	if err := json.Unmarshal(data, &token); err != nil {
		return nil, err
	}

	return &token, nil
}

// DeleteToken removes a stored token
func (s *Storage) DeleteToken(startUrl string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	filename := hashStartUrl(startUrl) + ".json"
	path := filepath.Join(s.tokensDir(), filename)

	return os.Remove(path)
}

// StorePendingAuth stores a pending device authorization
func (s *Storage) StorePendingAuth(auth *DeviceAuthorizationResult) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	dir := s.pendingAuthDir()
	if err := s.ensureDir(dir); err != nil {
		return err
	}

	filename := hashStartUrl(auth.StartUrl) + ".json"
	path := filepath.Join(dir, filename)

	data, err := json.MarshalIndent(auth, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0600)
}

// GetPendingAuth retrieves a pending device authorization
func (s *Storage) GetPendingAuth(startUrl string) (*DeviceAuthorizationResult, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	filename := hashStartUrl(startUrl) + ".json"
	path := filepath.Join(s.pendingAuthDir(), filename)

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var auth DeviceAuthorizationResult
	if err := json.Unmarshal(data, &auth); err != nil {
		return nil, err
	}

	return &auth, nil
}

// DeletePendingAuth removes a pending authorization
func (s *Storage) DeletePendingAuth(startUrl string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	filename := hashStartUrl(startUrl) + ".json"
	path := filepath.Join(s.pendingAuthDir(), filename)

	return os.Remove(path)
}

// StoreSession saves an SSO session with its accounts
func (s *Storage) StoreSession(session *SSOSession) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	dir := s.sessionsDir()
	if err := s.ensureDir(dir); err != nil {
		return err
	}

	filename := sanitizeName(session.Name) + ".json"
	path := filepath.Join(dir, filename)

	data, err := json.MarshalIndent(session, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0600)
}

// GetSession retrieves a stored session by name
func (s *Storage) GetSession(name string) (*SSOSession, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	filename := sanitizeName(name) + ".json"
	path := filepath.Join(s.sessionsDir(), filename)

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var session SSOSession
	if err := json.Unmarshal(data, &session); err != nil {
		return nil, err
	}

	return &session, nil
}

// ListSessions returns all stored sessions
func (s *Storage) ListSessions() ([]SSOSession, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	dir := s.sessionsDir()
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return []SSOSession{}, nil
		}
		return nil, err
	}

	var sessions []SSOSession
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}

		path := filepath.Join(dir, entry.Name())
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}

		var session SSOSession
		if err := json.Unmarshal(data, &session); err != nil {
			continue
		}

		sessions = append(sessions, session)
	}

	return sessions, nil
}

// DeleteSession removes a stored session
func (s *Storage) DeleteSession(name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	filename := sanitizeName(name) + ".json"
	path := filepath.Join(s.sessionsDir(), filename)

	return os.Remove(path)
}

// ContextMapping represents a mapping from a k8s context to an AWS role
type ContextMapping struct {
	ContextName string    `json:"contextName"`
	SessionName string    `json:"sessionName"`
	AccountId   string    `json:"accountId"`
	RoleName    string    `json:"roleName"`
	StartUrl    string    `json:"startUrl"`
	Region      string    `json:"region"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// ContextMappings holds all context to AWS role mappings
type ContextMappings struct {
	Mappings []ContextMapping `json:"mappings"`
}

// mappingsPath returns the path to the context mappings file
func (s *Storage) mappingsPath() string {
	return filepath.Join(s.basePath, "context-mappings.json")
}

// GetContextMappings retrieves all context mappings
func (s *Storage) GetContextMappings() (*ContextMappings, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	path := s.mappingsPath()
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return &ContextMappings{Mappings: []ContextMapping{}}, nil
		}
		return nil, err
	}

	var mappings ContextMappings
	if err := json.Unmarshal(data, &mappings); err != nil {
		return nil, err
	}

	return &mappings, nil
}

// SetContextMapping adds or updates a context mapping
func (s *Storage) SetContextMapping(mapping ContextMapping) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Ensure base dir exists
	if err := s.ensureDir(s.basePath); err != nil {
		return err
	}

	path := s.mappingsPath()

	// Load existing mappings
	var mappings ContextMappings
	data, err := os.ReadFile(path)
	if err == nil {
		json.Unmarshal(data, &mappings)
	}

	// Update or add mapping
	mapping.UpdatedAt = time.Now()
	found := false
	for i, m := range mappings.Mappings {
		if m.ContextName == mapping.ContextName {
			mappings.Mappings[i] = mapping
			found = true
			break
		}
	}
	if !found {
		mappings.Mappings = append(mappings.Mappings, mapping)
	}

	// Save
	data, err = json.MarshalIndent(mappings, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0600)
}

// GetContextMapping retrieves a specific context mapping
func (s *Storage) GetContextMapping(contextName string) (*ContextMapping, error) {
	mappings, err := s.GetContextMappings()
	if err != nil {
		return nil, err
	}

	for _, m := range mappings.Mappings {
		if m.ContextName == contextName {
			return &m, nil
		}
	}

	return nil, fmt.Errorf("no mapping found for context: %s", contextName)
}

// DeleteContextMapping removes a context mapping
func (s *Storage) DeleteContextMapping(contextName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	path := s.mappingsPath()

	var mappings ContextMappings
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	if err := json.Unmarshal(data, &mappings); err != nil {
		return err
	}

	// Filter out the mapping
	var newMappings []ContextMapping
	for _, m := range mappings.Mappings {
		if m.ContextName != contextName {
			newMappings = append(newMappings, m)
		}
	}
	mappings.Mappings = newMappings

	data, err = json.MarshalIndent(mappings, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0600)
}

