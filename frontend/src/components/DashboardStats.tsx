const DashboardStats = () => {
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      
      <div className="bg-[#2a2a2a] p-4 rounded-xl">
        <p className="text-gray-400">Pendientes</p>
        <h2 className="text-2xl text-yellow-400">12</h2>
      </div>

      <div className="bg-[#2a2a2a] p-4 rounded-xl">
        <p className="text-gray-400">Entregadas hoy</p>
        <h2 className="text-2xl text-green-400">7</h2>
      </div>

      <div className="bg-[#2a2a2a] p-4 rounded-xl">
        <p className="text-gray-400">Con atraso</p>
        <h2 className="text-2xl text-red-400">3</h2>
      </div>

    </div>
  );
};

export default DashboardStats;