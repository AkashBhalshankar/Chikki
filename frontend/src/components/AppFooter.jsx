export default function AppFooter() {
  return (
    <footer className="mt-8 border-t border-gray-800 py-4 text-[10px] text-gray-600">
      <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-chikki-green" />
          <span className="uppercase tracking-[0.16em] text-gray-500">Chikki</span>
          <span className="text-gray-800">/</span>
          <span>Akash Bhalshankar</span>
        </div>
        <span className="text-center sm:text-right">Voice-first AI career assistant © {new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}
