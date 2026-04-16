const mockData = [
  { dpto: "804", nombre: "Martínez", courier: "Mercado Libre", estado: "Pendiente" },
  { dpto: "305", nombre: "González", courier: "Falabella", estado: "Pendiente" },
  { dpto: "102", nombre: "López", courier: "Rappi", estado: "Atraso" },
];

const RecentPackages = () => {
  return (
    <div className="bg-[#2a2a2a] p-4 rounded-xl">
      <h2 className="mb-4">Encomiendas recientes</h2>

      <table className="w-full text-sm">
        <thead className="text-gray-400">
          <tr>
            <th className="text-left">Dpto</th>
            <th className="text-left">Remitente</th>
            <th className="text-left">Estado</th>
          </tr>
        </thead>

        <tbody>
          {mockData.map((item, i) => (
            <tr key={i} className="border-t border-gray-600">
              <td>{item.dpto}</td>
              <td>{item.courier}</td>
              <td>
                <span className="px-2 py-1 rounded bg-yellow-600 text-xs">
                  {item.estado}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RecentPackages;