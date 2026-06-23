import { beforeEach, describe, expect, it } from "bun:test";
import jwt from "jsonwebtoken";
import {
  decodeToken,
  generateRefreshToken,
  generateToken,
  verifyRefreshToken,
  verifyToken,
  type TokenPayload,
} from "../../src/utils/jwt";

const secret = "unit-test-secret";

const user: TokenPayload = {
  id: 42,
  email: "residente@example.com",
  name: "Residente Unitario",
  role: "residente",
  username: "residente_unit",
};

describe("jwt utils", () => {
  beforeEach(() => {
    // # El unit test fija el secreto en memoria para no depender de backend/.env.
    process.env.JWT_SECRET = secret;
  });

  it("generateToken crea un access token verificable con el payload esperado", () => {
    const token = generateToken(user);
    const payload = verifyToken(token);

    expect(payload.id).toBe(user.id);
    expect(payload.email).toBe(user.email);
    expect(payload.name).toBe(user.name);
    expect(payload.role).toBe(user.role);
    expect(payload.username).toBe(user.username);
    expect(payload.exp).toBeNumber();
    expect(payload.iat).toBeNumber();
  });

  it("verifyToken rechaza tokens invalidos o firmados con otro secreto", () => {
    const invalidToken = jwt.sign(user, "otro-secreto", {
      algorithm: "HS256",
      issuer: "app-encomiendas",
    });

    expect(() => verifyToken("token.mal.formado")).toThrow();
    expect(() => verifyToken(invalidToken)).toThrow();
  });

  it("verifyToken rechaza un token expirado", () => {
    const expiredToken = jwt.sign(
      {
        ...user,
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      secret,
      {
        algorithm: "HS256",
        issuer: "app-encomiendas",
        subject: String(user.id),
      }
    );

    // # Cubrimos el borde de seguridad: un token bien firmado pero vencido no debe autenticar.
    expect(() => verifyToken(expiredToken)).toThrow();
  });

  it("decodeToken permite inspeccionar payload sin usarlo como autenticacion", () => {
    const token = generateToken(user);

    expect(decodeToken(token)).toMatchObject({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    expect(decodeToken("no-es-jwt")).toBeNull();
  });

  it("generateRefreshToken marca el token como refresh y lo verifica", () => {
    const refreshToken = generateRefreshToken(user.id);
    const payload = verifyRefreshToken(refreshToken);

    expect(payload).toMatchObject({
      id: user.id,
      type: "refresh",
    });
  });

  it("lanza un error claro cuando falta JWT_SECRET", () => {
    delete process.env.JWT_SECRET;

    expect(() => generateToken(user)).toThrow(
      "JWT_SECRET no está configurado en variables de entorno"
    );
    expect(() => verifyToken("cualquier-token")).toThrow(
      "JWT_SECRET no está configurado en variables de entorno"
    );
  });
});
