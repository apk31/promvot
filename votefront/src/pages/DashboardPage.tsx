import { useEffect, useState, useRef } from 'react';
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

interface VoterDetail {
  student_id: string;
  is_active: boolean;
  used_at: string | null;
}

const WIB_TIMEZONE = 'Asia/Jakarta';
const WIB_OFFSET_HOURS = 7;
const TIMESTAMP_WITH_ZONE_RE = /(?:Z|[+-]\d{2}:?\d{2})$/i;
const TIMESTAMP_PARTS_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?)?$/;
const voteTimestampFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: WIB_TIMEZONE,
  dateStyle: 'medium',
  timeStyle: 'short',
});

function parseVoteTimestamp(timestamp: string) {
  const normalized = timestamp.trim().replace(' ', 'T');

  if (TIMESTAMP_WITH_ZONE_RE.test(normalized)) {
    const zonedDate = new Date(normalized);
    return Number.isNaN(zonedDate.getTime()) ? null : zonedDate;
  }

  const match = normalized.match(TIMESTAMP_PARTS_RE);
  if (!match) {
    return null;
  }

  const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;

  // Treat timezone-less database timestamps as WIB wall-clock values.
  const utcTimestamp = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) - WIB_OFFSET_HOURS,
    Number(minute),
    Number(second)
  );

  const parsedDate = new Date(utcTimestamp);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function formatVoteTimestamp(timestamp: string | null) {
  if (!timestamp) {
    return <span className="text-stone-300 italic">Not yet submitted</span>;
  }

  const parsedDate = parseVoteTimestamp(timestamp);
  if (!parsedDate) {
    return <span className="text-red-500 italic">Invalid timestamp</span>;
  }

  return `${voteTimestampFormatter.format(parsedDate)} WIB`;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'results' | 'voters' | 'details'>('results');
  const [data, setData] = useState<DashboardData | null>(null);
  const [voterData, setVoterData] = useState<VoterData | null>(null);
  const [voterDetails, setVoterDetails] = useState<VoterDetail[] | null>(null);
  const [error, setError] = useState('');
  
  // Filters State
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [detailStatusFilter, setDetailStatusFilter] = useState<'ALL' | 'VOTED' | 'PENDING'>('ALL'); 
  
  const intervalRef = useRef<number | null>(null);

  const fetchDashboardData = async () => {
    // const token = localStorage.getItem('adminToken');

    try {
      // const headers = { 'Authorization': `Bearer ${token}` };
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const fetchOptions = { credentials: 'include' as RequestCredentials };
      
      const [resResults, resVoters, resDetails] = await Promise.all([
        fetch(`${apiUrl}/admin/results`, fetchOptions),
        fetch(`${apiUrl}/admin/voters`, fetchOptions),
        fetch(`${apiUrl}/admin/voters/detail`, fetchOptions)
      ]);

      if (resResults.status === 401 || resResults.status === 403) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        localStorage.removeItem('adminToken');
        navigate('/admin/login');
        return;
      }

      if (!resResults.ok || !resVoters.ok || !resDetails.ok) throw new Error('Failed to fetch');
      
      setData(await resResults.json());
      setVoterData(await resVoters.json());
      setVoterDetails(await resDetails.json());
      setError('');
    } catch (err) {
      setError('Connection lost. Reconnecting...');
    }
  };

  useEffect(() => {
    fetchDashboardData();
    intervalRef.current = window.setInterval(fetchDashboardData, 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const handleLogout = async () => {
    // 1. Stop the auto-refresh
    if (intervalRef.current) clearInterval(intervalRef.current);

    try {
      // 2. Call the backend to destroy the HttpOnly cookie
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      await fetch(`${apiUrl}/admin/logout`, {
        method: 'POST',
        credentials: 'include' // <-- CRITICAL: Tells the browser to send the cookie so the backend can clear it
      });
    } catch (err) {
      console.error('Logout request failed:', err);
    }

    // 3. Teleport the user back to the login screen
    navigate('/admin/login');
  };

  if (!data || !voterData || !voterDetails) {
    return (
      <div className="min-h-screen bg-[#FCFBF8] flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-red-900 mb-4"></div>
        <p className="text-red-900 font-bold tracking-wide">Connecting to Live Server...</p>
      </div>
    );
  }

  // --- TAB 2: PENDING VOTERS LOGIC ---
  const pendingUsers = voterData.pending_users;
  const classCounts = pendingUsers.reduce((acc, student) => {
    const prefix = student.split('-')[0];
    if (prefix) acc[prefix] = (acc[prefix] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const sortedClasses = Object.keys(classCounts).sort();
  const filteredPending = selectedClass === 'ALL' ? pendingUsers : pendingUsers.filter(s => s.startsWith(selectedClass));

  // --- TAB 3: DETAILED LOGS FILTER LOGIC (Dynamic Cascade) ---
  
  // 1. First, filter everyone by the Status Toggle
  const statusFilteredDetails = voterDetails.filter(u => {
    if (detailStatusFilter === 'ALL') return true;
    if (detailStatusFilter === 'VOTED') return !u.is_active; // is_active false = voted
    return u.is_active; // is_active true = pending
  });

  // 2. NOW, count the classes based ONLY on the people who passed the Status Filter
  const detailsClassCounts = statusFilteredDetails.reduce((acc, user) => {
    const prefix = user.student_id.split('-')[0];
    if (prefix) acc[prefix] = (acc[prefix] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const sortedDetailClasses = Object.keys(detailsClassCounts).sort();
  
  // 3. Finally, filter the table rows by the selected Class button
  const filteredDetails = statusFilteredDetails.filter(u => 
    selectedClass === 'ALL' || u.student_id.startsWith(selectedClass)
  );

  return (
    <div className="min-h-screen bg-[#e4dcc2] p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        
        {/* HEADER */}
        <div className="bg-white rounded-3xl p-6 shadow-sm mb-8 border border-stone-200">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-red-900">Promnight 2026 Vote Dashboard</h1>
              <div className="flex items-center gap-2 mt-2">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </div>
                <p className="text-green-600 font-bold text-sm tracking-wide uppercase">Live Tracking</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <button onClick={fetchDashboardData} className="flex-1 md:flex-none px-5 py-2.5 bg-stone-100 text-stone-700 rounded-xl font-bold text-sm active:bg-stone-200 transition-colors">
                🔄 Sync
              </button>
              <button onClick={handleLogout} className="flex-1 md:flex-none px-5 py-2.5 bg-red-50 text-red-900 rounded-xl font-bold text-sm hover:bg-red-100 border border-red-100 transition-colors">
                Logout
              </button>
            </div>
          </div>

          <div className="flex bg-stone-100 p-1.5 rounded-2xl flex-wrap gap-1">
            <button 
              onClick={() => { setActiveTab('results'); setSelectedClass('ALL'); }}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all min-w-[120px] ${activeTab === 'results' ? 'bg-white text-red-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              📊 Live Results
            </button>
            <button 
              onClick={() => { setActiveTab('voters'); setSelectedClass('ALL'); }}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all min-w-[120px] ${activeTab === 'voters' ? 'bg-white text-red-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              👥 Voter Status
            </button>
            <button 
              onClick={() => { setActiveTab('details'); setSelectedClass('ALL'); setDetailStatusFilter('ALL'); }}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all min-w-[120px] ${activeTab === 'details' ? 'bg-white text-red-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              📋 Detailed Logs
            </button>
          </div>
        </div>

        {/* TAB 1: LIVE RESULTS */}
        {activeTab === 'results' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-[fadeIn_0.3s_ease-out]">
            {data.categories.map((cat) => {
              const totalCategoryVotes = cat.results.reduce((sum, nom) => sum + nom.votes, 0);
              const maxVotes = Math.max(...cat.results.map(n => n.votes));
              const isTie = cat.results.filter(n => n.votes === maxVotes && maxVotes > 0).length > 1;

              return (
                <div key={cat.category_id} className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200">
                  <h2 className="text-xl font-black text-stone-800 mb-6">{cat.category_name}</h2>
                  <div className="space-y-5">
                    {cat.results.map((nominee) => {
                      const percentage = totalCategoryVotes === 0 ? 0 : Math.round((nominee.votes / totalCategoryVotes) * 100);
                      const isWinner = nominee.votes === maxVotes && maxVotes > 0;
                      
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
                  {filteredPending.map(student => (
                    <div key={student} className="bg-[#FCFBF8] py-3 px-2 rounded-xl border border-stone-200 text-center font-bold text-stone-600 text-sm">
                      {student}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: DETAILED LOGS */}
        {activeTab === 'details' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-200 animate-[fadeIn_0.3s_ease-out]">
            
            <div className="mb-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-xl font-black text-stone-800">Complete Audit Log</h3>
                
                {/* Status Filter Toggles */}
                <div className="flex bg-stone-100 p-1 rounded-xl w-full sm:w-auto shrink-0">
                  <button 
                    onClick={() => { setDetailStatusFilter('ALL'); setSelectedClass('ALL'); }}
                    className={`flex-1 sm:px-4 py-2 rounded-lg font-bold text-sm transition-all ${detailStatusFilter === 'ALL' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                  >All</button>
                  <button 
                    onClick={() => { setDetailStatusFilter('VOTED'); setSelectedClass('ALL'); }}
                    className={`flex-1 sm:px-4 py-2 rounded-lg font-bold text-sm transition-all ${detailStatusFilter === 'VOTED' ? 'bg-white text-green-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                  >Voted</button>
                  <button 
                    onClick={() => { setDetailStatusFilter('PENDING'); setSelectedClass('ALL'); }}
                    className={`flex-1 sm:px-4 py-2 rounded-lg font-bold text-sm transition-all ${detailStatusFilter === 'PENDING' ? 'bg-white text-amber-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                  >Pending</button>
                </div>
              </div>

              {/* DYNAMIC Class Filters */}
              {sortedDetailClasses.length > 0 && (
                <div className="flex overflow-x-auto pb-2 -mx-2 px-2 md:pb-0 md:mx-0 md:px-0 gap-2 hide-scrollbar">
                  <button
                    onClick={() => setSelectedClass('ALL')}
                    className={`whitespace-nowrap px-4 py-2 rounded-xl font-bold text-sm transition-all ${selectedClass === 'ALL' ? 'bg-red-900 text-amber-500 shadow-md' : 'bg-stone-100 text-stone-600'}`}
                  >
                    All Classes ({statusFilteredDetails.length})
                  </button>
                  {sortedDetailClasses.map(cls => (
                    <button
                      key={cls}
                      onClick={() => setSelectedClass(cls)}
                      className={`whitespace-nowrap px-4 py-2 rounded-xl font-bold text-sm transition-all ${selectedClass === cls ? 'bg-red-900 text-amber-500 shadow-md' : 'bg-stone-100 text-stone-600'}`}
                    >
                      {cls} <span className="opacity-75">({detailsClassCounts[cls]})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="overflow-x-auto rounded-2xl border border-stone-200">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200">
                    <th className="p-4 text-xs font-black text-stone-500 uppercase tracking-widest w-1/3">Student ID</th>
                    <th className="p-4 text-xs font-black text-stone-500 uppercase tracking-widest w-1/3">Status</th>
                    <th className="p-4 text-xs font-black text-stone-500 uppercase tracking-widest w-1/3">Timestamp Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDetails.map((user) => {
                    const formattedDate = formatVoteTimestamp(user.used_at);

                    return (
                      <tr key={user.student_id} className="border-b border-stone-100 hover:bg-stone-50/50 transition-colors">
                        <td className="p-4 font-bold text-stone-800">{user.student_id}</td>
                        <td className="p-4">
                          {!user.is_active ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-green-50 text-green-700 font-bold text-xs border border-green-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                              Voted
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 text-amber-700 font-bold text-xs border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-sm font-medium text-stone-600">
                          {formattedDate}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredDetails.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-10 text-center text-stone-500 font-medium">
                        No records match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
