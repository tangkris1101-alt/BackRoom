CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL,
  email VARCHAR(254) NOT NULL,
  display_name VARCHAR(32) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email_verified_at DATETIME(3) NULL,
  verification_token_hash BINARY(32) NULL,
  verification_expires_at DATETIME(3) NULL,
  password_changed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_unique (email),
  KEY users_verification_token_index (verification_token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash BINARY(32) NOT NULL,
  user_id CHAR(36) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (token_hash),
  KEY sessions_user_index (user_id),
  KEY sessions_expiry_index (expires_at),
  CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash BINARY(32) NOT NULL,
  user_id CHAR(36) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  used_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (token_hash),
  KEY password_resets_user_index (user_id),
  KEY password_resets_expiry_index (expires_at),
  CONSTRAINT password_resets_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS game_saves (
  user_id CHAR(36) NOT NULL,
  revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
  envelope_json JSON NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (user_id),
  CONSTRAINT game_saves_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS game_save_revisions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id CHAR(36) NOT NULL,
  revision BIGINT UNSIGNED NOT NULL,
  envelope_json JSON NOT NULL,
  saved_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY game_save_revision_unique (user_id, revision),
  KEY game_save_revision_saved_at_index (saved_at),
  CONSTRAINT game_save_revisions_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
