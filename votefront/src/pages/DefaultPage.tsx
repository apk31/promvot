export default function DefaultPage() {
  return (
    <div className="min-h-screen bg-[#e4dcc2] flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-2xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-red-600 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
          🔒
        </div>
        <h1 className="text-3xl font-['Cormorant_Infant'] font-bold text-gray-800 mb-2">Access Denied</h1>
        <p className="text-gray-600 mb-6">
          Voting can only be accessed via secure magic links.
        </p>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-700">
            Please ask your class leader for your unique voting link to access this portal.
          </p>
        </div>
        <p className="text-gray-600 mb-6 italic text-sm">
          <br />see nominees profiles on our <a href="https://www.instagram.com/promkosayu26/" className="text-red-600 font-bold underline">Instagram</a>
        </p>
      </div>
    </div>
  );
}