-- Migración: ejecutar después de que existan las tablas packages y users.
CREATE TABLE IF NOT EXISTS claims (
  id INT AUTO_INCREMENT PRIMARY KEY,
  package_id INT NOT NULL,
  resident_id INT NOT NULL,
  description TEXT NOT NULL,
  status ENUM('open', 'in_review', 'closed') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Cada reclamo debe apuntar a una encomienda existente.
  CONSTRAINT fk_claims_package_id FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
  -- El residente queda fijado al usuario autenticado que abrió el reclamo.
  CONSTRAINT fk_claims_resident_id FOREIGN KEY (resident_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_claims_package_id (package_id),
  INDEX idx_claims_resident_id (resident_id),
  INDEX idx_claims_status (status),
  INDEX idx_claims_created_at (created_at)
);
