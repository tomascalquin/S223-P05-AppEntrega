-- ========================================
-- TABLA DE USUARIOS
-- ========================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(100),
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role ENUM('conserje', 'residente') DEFAULT 'residente',
  picture VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role)
);

-- ========================================
-- TABLA DE REFRESH TOKENS (para renovación de tokens)
-- ========================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at)
);

-- ========================================
-- TABLA DE PAQUETES
-- ========================================
CREATE TABLE IF NOT EXISTS packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recipient_name VARCHAR(255) NOT NULL,
  -- Correo al que se envía el QR de retiro cuando se registra la encomienda.
  recipient_email VARCHAR(255) NOT NULL DEFAULT '',
  apartment_number VARCHAR(50) NOT NULL,
  description TEXT,
  sender VARCHAR(255) NOT NULL,
  delivery_date TIMESTAMP NULL,
  status ENUM('received', 'delivered', 'pending') DEFAULT 'received',
  -- Identificador único que viaja dentro del QR. Queda NULL después de entregar.
  retrieval_code VARCHAR(32) NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
