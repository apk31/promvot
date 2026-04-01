import { BrowserRouter, Routes, Route } from 'react-router-dom';
import DefaultPage from './pages/DefaultPage';
import VotePage from './pages/VotePage';
import DashboardPage from './pages/DashboardPage';
import AdminLogin from './pages/AdminLogin'; // <-- Import the new page

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DefaultPage />} />
        <Route path="/vote" element={<VotePage />} />
        
        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<DashboardPage />} /> 
      </Routes>
    </BrowserRouter>
  );
}

export default App;
