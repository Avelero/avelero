export function PassportMenu() {
  return (
    <div className="absolute inset-0 flex items-center justify-center text-[#1E2040] p-[12.8cqw] text-[2.5cqw]">
      {/* First Menu - Background */}
      <div className="absolute border-[#E9E9EC] border-[0.2cqw] w-[61.6cqw] left-[12.8cqw] top-[32.8cqw]">
        <div className="bg-white hover:brightness-[0.97] transition-all duration-100 cursor-pointer border-[#E9E9EC] border-b-[0.2cqw] px-[1.9cqw] py-[2.5cqw]">
          <div className="flex items-center justify-between">
            <span className="font-geist-sans">CARE INSTRUCTIONS</span>
            <svg className="w-[3.1cqw] h-[3.1cqw]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
        <div className="bg-white hover:brightness-[0.97] transition-all duration-100 cursor-pointer border-[#E9E9EC] border-b-[0.2cqw] px-[1.9cqw] py-[2.5cqw]">
          <div className="flex items-center justify-between">
            <span className="font-geist-sans">RECYCLING & REPAIR</span>
            <svg className="w-[3.1cqw] h-[3.1cqw]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
        <div className="bg-white hover:brightness-[0.97] transition-all duration-100 cursor-pointer px-[1.9cqw] py-[2.5cqw]">
          <div className="flex items-center justify-between">
            <span className="font-geist-sans">WARRANTY</span>
            <svg className="w-[3.1cqw] h-[3.1cqw]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Second Menu - Foreground */}
      <div className="absolute border-[#E9E9EC] border-[0.2cqw] w-[61.6cqw] bottom-[32.8cqw] right-[12.8cqw]">
        <div className="bg-white hover:brightness-[0.97] transition-all duration-100 cursor-pointer border-[#E9E9EC] border-b-[0.2cqw] px-[1.9cqw] py-[2.5cqw]">
          <div className="flex items-center justify-between">
            <span className="font-geist-sans">RESELL & BUYBACK</span>
            <svg className="w-[3.1cqw] h-[3.1cqw]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
        <div className="bg-white hover:brightness-[0.97] transition-all duration-100 cursor-pointer px-[1.9cqw] py-[2.5cqw]">
          <div className="flex items-center justify-between">
            <span className="font-geist-sans">VERIFICATION</span>
            <svg className="w-[3.1cqw] h-[3.1cqw]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
