import { useEffect, useState,useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface NomineeResult {
  nominee_id: number;
  name: string;
  votes: number;
}

interface CategoryResult {
  category_id: number;
  category_name: string;
  results: NomineeResult[];
}

interface DashboardData {
  total_ballots: number;
  categories: CategoryResult[];
}

interface VoterData {
  total_users: number;
  voted_count: number;
  pending_users: string[];
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'results' | 'voters'>('results');
  const [data, setData] = useState<DashboardData | null>(null);
  const [voterData, setVoterData] = useState<VoterData | null>(null);
  const [error, setError] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const intervalRef = useRef<number | null>(null);

// NEW: Function to check if the JWT has expired locally
  const isTokenExpired = (token: string) => {
    try {
      // Decode the middle payload portion of the JWT
      const payload = JSON.parse(atob(token.split('.')[1]));
      // JWT exp is in seconds, Date.now() is in milliseconds
      return payload.exp * 1000 < Date.now();
    } catch (e) {
      return true; // If it fails to parse, assume it's invalid/expired
    }
  };

  const fetchDashboardData = async () => {
    const token = localStorage.getItem('adminToken');
    
    // NEW: Check expiration before even talking to the backend
    if (!token || isTokenExpired(token)) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      localStorage.removeItem('adminToken');
      navigate('/admin/login');
      return;
    }

    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      // Use your dynamic API URL for production
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      
      const [resResults, resVoters] = await Promise.all([
        fetch(`${apiUrl}/admin/results`, { headers }),
        fetch(`${apiUrl}/admin/voters`, { headers })
      ]);

      if (resResults.status === 401 || resResults.status === 403) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        localStorage.removeItem('adminToken');
        navigate('/admin/login');
        return;
      }

      if (!resResults.ok || !resVoters.ok) throw new Error('Failed to fetch');
      
      setData(await resResults.json());
      setVoterData(await resVoters.json());
      setError('');
    } catch (err) {
      setError('Connection lost. Reconnecting...');
    }
  };

  useEffect(() => {
    fetchDashboardData();
    intervalRef.current = window.setInterval(fetchDashboardData, 10000);
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleLogout = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  };

  if (!data || !voterData) {
    return (
      <div className="min-h-screen bg-[#FCFBF8] flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-red-900 mb-4"></div>
        <p className="text-red-900 font-bold tracking-wide">Connecting to Live Server...</p>
      </div>
    );
  }

  const pendingUsers = voterData.pending_users;
  const classCounts = pendingUsers.reduce((acc, student) => {
    const prefix = student.split('-')[0];
    if (prefix) acc[prefix] = (acc[prefix] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const sortedClasses = Object.keys(classCounts).sort();
  const filteredUsers = selectedClass === 'ALL' ? pendingUsers : pendingUsers.filter(s => s.startsWith(selectedClass));

  return (
    <div className="min-h-screen bg-[#FCFBF8] p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* MOBILE OPTIMIZED HEADER */}
        <div className="bg-white rounded-3xl p-6 shadow-sm mb-8 border border-stone-200">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-red-900">Promvote Dashboard</h1>
              <div className="flex items-center gap-2 mt-2">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </div>
                <p className="text-green-600 font-bold text-sm tracking-wide uppercase">Live Tracking</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <button onClick={fetchDashboardData} className="flex-1 md:flex-none px-5 py-2.5 bg-stone-100 text-stone-700 rounded-xl font-bold text-sm active:bg-stone-200">
                🔄 Sync
              </button>
              <button onClick={handleLogout} className="flex-1 md:flex-none px-5 py-2.5 bg-red-50 text-red-900 rounded-xl font-bold text-sm hover:bg-red-100 border border-red-100">
                Logout
              </button>
            </div>
          </div>

          <div className="flex bg-stone-100 p-1.5 rounded-2xl">
            <button 
              onClick={() => setActiveTab('results')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'results' ? 'bg-white text-red-900 shadow-sm' : 'text-stone-500'}`}
            >
              📊 Live Results
            </button>
            <button 
              onClick={() => setActiveTab('voters')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'voters' ? 'bg-white text-red-900 shadow-sm' : 'text-stone-500'}`}
            >
              👥 Voter Status
            </button>
          </div>
        </div>

        {/* TAB 1: LIVE RESULTS */}
        {activeTab === 'results' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-[fadeIn_0.3s_ease-out]">
            {data.categories.map((cat) => {
              const totalCategoryVotes = cat.results.reduce((sum, nom) => sum + nom.votes, 0);
              const maxVotes = Math.max(...cat.results.map(n => n.votes));
              const winnersCount = cat.results.filter(n => n.votes === maxVotes && maxVotes > 0).length;
              const isTie = winnersCount > 1;

              return (
                <div key={cat.category_id} className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200">
                  <h2 className="text-xl font-black text-stone-800 mb-6">{cat.category_name}</h2>
                  <div className="space-y-5">
                    {cat.results.map((nominee) => {
                      const percentage = totalCategoryVotes === 0 ? 0 : Math.round((nominee.votes / totalCategoryVotes) * 100);
                      const isWinner = nominee.votes === maxVotes && maxVotes > 0;
                      
                      // THEME LOGIC: Burgundy for clear winner, Gold for Tie!
                      const barColor = isWinner ? (isTie ? 'bg-amber-500' : 'bg-red-900') : 'bg-stone-200';
                      const textColor = isWinner ? (isTie ? 'text-amber-600' : 'text-red-900') : 'text-stone-600';
                      const icon = isWinner ? (isTie ? '⚔️ ' : '🏆 ') : '';

                      return (
                        <div key={nominee.nominee_id} className="relative">
                          <div className="flex justify-between items-end mb-1">
                            <span className={`font-bold ${textColor} truncate pr-4`}>{icon}{nominee.name}</span>
                            <span className="font-black text-stone-800">{nominee.votes} <span className="text-xs font-bold text-stone-400 font-normal">({percentage}%)</span></span>
                          </div>
                          <div className="h-3 w-full bg-stone-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-1000 ${barColor}`} style={{ width: `${percentage}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: VOTER STATUS */}
        {activeTab === 'voters' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-200 animate-[fadeIn_0.3s_ease-out]">
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <div className="flex-1 bg-stone-50 p-6 rounded-3xl border border-stone-200 text-center">
                <p className="text-sm font-black text-stone-500 uppercase tracking-widest">Total Ballots</p>
                <p className="text-5xl font-black text-red-900 mt-2">{voterData.voted_count}</p>
              </div>
              <div className="flex-1 bg-amber-50 p-6 rounded-3xl border border-amber-200 text-center">
                <p className="text-sm font-black text-amber-600 uppercase tracking-widest">Pending</p>
                <p className="text-5xl font-black text-amber-700 mt-2">{pendingUsers.length}</p>
              </div>
            </div>

            <div className="border-t border-stone-100 pt-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                 <h3 className="text-xl font-black text-stone-800">Students Yet to Vote</h3>
                 {pendingUsers.length > 0 && (
                   <div className="flex overflow-x-auto pb-2 -mx-2 px-2 md:pb-0 md:mx-0 md:px-0 gap-2 hide-scrollbar">
                     <button
                       onClick={() => setSelectedClass('ALL')}
                       className={`whitespace-nowrap px-4 py-2 rounded-xl font-bold text-sm transition-all ${selectedClass === 'ALL' ? 'bg-red-900 text-amber-500 shadow-md' : 'bg-stone-100 text-stone-600'}`}
                     >
                       All ({pendingUsers.length})
                     </button>
                     {sortedClasses.map(cls => (
                       <button
                         key={cls}
                         onClick={() => setSelectedClass(cls)}
                         className={`whitespace-nowrap px-4 py-2 rounded-xl font-bold text-sm transition-all ${selectedClass === cls ? 'bg-red-900 text-amber-500 shadow-md' : 'bg-stone-100 text-stone-600'}`}
                       >
                         {cls} <span className="opacity-75">({classCounts[cls]})</span>
                       </button>
                     ))}
                   </div>
                 )}
              </div>
              
              {pendingUsers.length === 0 ? (
                <div className="text-center p-10 bg-[#FCFBF8] rounded-3xl border-2 border-dashed border-stone-200">
                  <span className="text-4xl block mb-3">🎉</span>
                  <p className="text-stone-500 font-black text-lg">100% Turnout! Everyone has voted.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {filteredUsers.map(student => (
                    <div key={student} className="bg-[#FCFBF8] py-3 px-2 rounded-xl border border-stone-200 text-center font-bold text-stone-600 text-sm">
                      {student}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}