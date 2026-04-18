import "dotenv/config";
import db from "../src/db";
import type { RowDataPacket } from "mysql2";

type Role = "conserje" | "residente";
type AuthUser = {
  id: string;
  role: Role;
  name: string;
  email: string;
  username: string;
};

type AuthResponse = {
  token: string;
  user: AuthUser;
  message?: string;
  error?: string;
};

type PackageItem = {
  id: number;
  recipient_name: string;
  apartment_number: string;
  description: string | null;
  sender: string;
  delivery_date: string | null;
  status: "received" | "delivered" | "pending";
  created_at: string;
};

type PackageCollectionResponse = {
  packages: PackageItem[];
  message?: string;
  error?: string;
};

type PackageMutationResponse = {
  id: number;
  package: PackageItem;
  message?: string;
  error?: string;
};

type StoredPackageRow = RowDataPacket & {
  id: number;
  recipient_name: string;
  apartment_number: string;
  sender: string;
  status: "received" | "delivered" | "pending";
};

const API_URL = process.env.TEST_API_URL?.trim() || "http://localhost:3001";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const requestJson = async <T>(
  path: string,
  init: RequestInit = {}
): Promise<{ status: number; data: T }> => {
  // # Centralizamos las llamadas HTTP para que cada paso del smoke test
  // # solo tenga que indicar endpoint, método y la validación esperada.
  const response = await fetch(`${API_URL}${path}`, init);
  const data = (await response.json()) as T;

  return {
    status: response.status,
    data,
  };
};

const registerUser = async (role: Role, uniqueId: string) => {
  // # Creamos usuarios descartables para que la prueba no dependa
  // # de cuentas preexistentes ni deje datos ambiguos entre corridas.
  const response = await requestJson<AuthResponse>("/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role,
      name:
        role === "conserje"
          ? `Conserje Prueba ${uniqueId}`
          : `Residente Prueba ${uniqueId}`,
      email: `${role}.${uniqueId}@encombox.test`,
      username: `${role}_${uniqueId}`,
      password: "PruebaSegura2026!",
    }),
  });

  assert(
    response.status === 201,
    `El registro de ${role} devolvió ${response.status} en vez de 201.`
  );
  assert(response.data.token, `El registro de ${role} no devolvió token.`);

  return response.data;
};

const fetchPackages = async (token: string) => {
  // # Consultamos el listado tal como lo haría la UI, usando el token
  // # del usuario autenticado para validar permisos y visibilidad.
  const response = await requestJson<PackageCollectionResponse>("/api/packages", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  assert(
    response.status === 200,
    `La consulta de paquetes devolvió ${response.status} en vez de 200.`
  );

  return response.data.packages;
};

const createPackage = async (
  token: string,
  recipientName: string,
  uniqueId: string
) => {
  // # Reproducimos el alta real de una encomienda para comprobar
  // # que la API acepta el payload esperado desde frontend.
  const response = await requestJson<PackageMutationResponse>("/api/packages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      recipient_name: recipientName,
      apartment_number: `A-${uniqueId.slice(-4)}`,
      sender: `Proveedor Prueba ${uniqueId}`,
      delivery_date: "2026-04-17",
    }),
  });

  assert(
    response.status === 200,
    `La creación de la encomienda devolvió ${response.status} en vez de 200.`
  );

  return response.data.package;
};

const updatePackageStatus = async (token: string, packageId: number) => {
  // # Este paso simula la acción rápida de conserjería para confirmar
  // # que el backend persiste el nuevo estado y devuelve el registro actualizado.
  const response = await requestJson<PackageMutationResponse>(
    `/api/packages/${packageId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        status: "delivered",
      }),
    }
  );

  assert(
    response.status === 200,
    `La actualización de estado devolvió ${response.status} en vez de 200.`
  );

  return response.data.package;
};

const findStoredPackage = async (packageId: number) => {
  // # Verificamos directamente la base de datos para asegurar que la
  // # persistencia ocurrió de verdad y no solo a nivel de respuesta HTTP.
  const [rows] = await db.query<StoredPackageRow[]>(
    "SELECT id, recipient_name, apartment_number, sender, status FROM packages WHERE id = ?",
    [packageId]
  );

  return rows[0] ?? null;
};

const cleanup = async (packageId: number | null, userIds: string[]) => {
  // # Limpiamos al final para que la prueba sea repetible y no ensucie
  // # la tabla con usuarios o encomiendas de smoke tests anteriores.
  if (packageId !== null) {
    await db.query("DELETE FROM packages WHERE id = ?", [packageId]);
  }

  if (userIds.length > 0) {
    await db.query("DELETE FROM users WHERE id IN (?)", [userIds]);
  }
};

async function runPackageFlowTest() {
  const uniqueId = `${Date.now()}`;
  let createdPackageId: number | null = null;
  const createdUserIds: string[] = [];

  try {
    console.log(`Probando flujo end-to-end contra ${API_URL}`);

    // # Primero generamos usuarios temporales con roles distintos para
    // # poder validar permisos reales sin depender de datos manuales.
    const conciergeSession = await registerUser("conserje", uniqueId);
    const residentSession = await registerUser("residente", uniqueId);
    createdUserIds.push(conciergeSession.user.id, residentSession.user.id);

    // # El conserje registra una encomienda dirigida al residente creado
    // # en esta misma corrida para mantener el test aislado y repetible.
    const createdPackage = await createPackage(
      conciergeSession.token,
      residentSession.user.name,
      uniqueId
    );
    createdPackageId = createdPackage.id;

    // # Confirmamos que el alta llegó hasta MySQL y que los datos guardados
    // # coinciden con lo que se envió desde la API.
    const storedPackage = await findStoredPackage(createdPackage.id);
    assert(storedPackage, "La encomienda no quedó guardada en la base de datos.");
    assert(
      storedPackage?.recipient_name === residentSession.user.name,
      "La encomienda guardada no coincide con el residente esperado."
    );
    assert(
      storedPackage?.status === "received",
      "La encomienda no quedó con estado inicial 'received'."
    );

    // # El conserje debe ver la encomienda en el historial general.
    const conciergePackages = await fetchPackages(conciergeSession.token);
    assert(
      conciergePackages.some((item) => item.id === createdPackage.id),
      "La encomienda creada no aparece en el listado de conserjería."
    );

    // # El residente también debe verla en su propio listado filtrado.
    const residentPackages = await fetchPackages(residentSession.token);
    const residentPackage = residentPackages.find(
      (item) => item.id === createdPackage.id
    );
    assert(
      residentPackage,
      "La encomienda creada no aparece en el listado del residente."
    );

    // # Probamos el cambio de estado end-to-end para cubrir la última parte
    // # del flujo funcional que pide la historia.
    const updatedPackage = await updatePackageStatus(
      conciergeSession.token,
      createdPackage.id
    );
    assert(
      updatedPackage.status === "delivered",
      "La API no devolvió el estado actualizado a 'delivered'."
    );

    // # Volvemos a consultar la base para confirmar que el cambio no fue
    // # solo visual y quedó persistido correctamente.
    const updatedStoredPackage = await findStoredPackage(createdPackage.id);
    assert(
      updatedStoredPackage?.status === "delivered",
      "El cambio de estado no quedó persistido en la base de datos."
    );

    // # Finalmente comprobamos que el residente también ve el nuevo estado,
    // # cerrando el ciclo completo entre escritura, almacenamiento y lectura.
    const residentPackagesAfterUpdate = await fetchPackages(residentSession.token);
    const deliveredResidentPackage = residentPackagesAfterUpdate.find(
      (item) => item.id === createdPackage.id
    );
    assert(
      deliveredResidentPackage?.status === "delivered",
      "El residente no ve reflejado el nuevo estado de la encomienda."
    );

    console.log("Flujo end-to-end validado correctamente.");
  } finally {
    await cleanup(createdPackageId, createdUserIds);
  }
}

runPackageFlowTest()
  .then(async () => {
    await db.end();
  })
  .catch(async (error) => {
    console.error("La verificación end-to-end falló:");
    console.error(error);
    await db.end();
    process.exit(1);
  });
