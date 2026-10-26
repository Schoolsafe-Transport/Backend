/**
 * Document Visual Generator Utility
 * Generates ultra-crisp, high-fidelity SVG document images for official credentials
 * (Driver's License, Vehicle Registration/Libre, Business Registration, Insurance).
 */

interface DocumentData {
  id: string;
  documentType: string;
  documentName?: string | null;
  status: string;
  expiryDate?: Date | string | null;
  createdAt: Date | string;
  fileMimeType?: string | null;
  fileUrl?: string | null;
}

interface UserData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  role?: string;
  businessName?: string | null;
}

/**
 * Escapes XML/SVG special characters.
 */
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Generates an authentic Ethiopian Commercial Driver's License SVG
 */
export function generateDriverLicenseSvg(doc: DocumentData, user: UserData): string {
  const firstName = escapeXml((user.firstName || 'Tesfahun').toUpperCase());
  const lastName = escapeXml((user.lastName || 'Nigus').toUpperCase());
  const licenseNum = escapeXml(`ET-CDL-${doc.id.replace(/-/g, '').substring(0, 10).toUpperCase()}`);
  const issueDate = new Date(doc.createdAt).toLocaleDateString('en-GB');
  const expiryDate = doc.expiryDate
    ? new Date(doc.expiryDate).toLocaleDateString('en-GB')
    : new Date(Date.now() + 4 * 365 * 24 * 3600 * 1000).toLocaleDateString('en-GB');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 540" width="100%" height="auto" style="border-radius: 20px; box-shadow: 0 20px 40px -15px rgba(15, 23, 42, 0.25);">
  <defs>
    <!-- Card Gradients -->
    <linearGradient id="cardBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F8FAFC"/>
      <stop offset="40%" stop-color="#EFF6FF"/>
      <stop offset="100%" stop-color="#E2E8F0"/>
    </linearGradient>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0F2B5C"/>
      <stop offset="50%" stop-color="#1E3A8A"/>
      <stop offset="100%" stop-color="#1E40AF"/>
    </linearGradient>
    <linearGradient id="goldTrim" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#F59E0B"/>
      <stop offset="50%" stop-color="#FCD34D"/>
      <stop offset="100%" stop-color="#D97706"/>
    </linearGradient>
    <linearGradient id="chipGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FBBF24"/>
      <stop offset="40%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#B45309"/>
    </linearGradient>
    <linearGradient id="hologramGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#67E8F9" stop-opacity="0.8"/>
      <stop offset="33%" stop-color="#F472B6" stop-opacity="0.8"/>
      <stop offset="66%" stop-color="#FBBF24" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#34D399" stop-opacity="0.8"/>
    </linearGradient>

    <!-- Guilloche Security Wave Pattern -->
    <pattern id="guilloche" width="60" height="40" patternUnits="userSpaceOnUse">
      <path d="M 0 20 Q 15 0 30 20 T 60 20" fill="none" stroke="#CBD5E1" stroke-width="0.75" stroke-opacity="0.4"/>
      <path d="M 0 20 Q 15 40 30 20 T 60 20" fill="none" stroke="#93C5FD" stroke-width="0.75" stroke-opacity="0.35"/>
      <circle cx="30" cy="20" r="14" fill="none" stroke="#E2E8F0" stroke-width="0.5"/>
    </pattern>

    <!-- Drop Shadows -->
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#0F172A" flood-opacity="0.12"/>
    </filter>
  </defs>

  <!-- Outer Card Frame with Rounded Corners -->
  <rect width="850" height="540" rx="24" fill="url(#cardBg)" stroke="#CBD5E1" stroke-width="2"/>
  <rect width="850" height="540" rx="24" fill="url(#guilloche)"/>

  <!-- Top Security Header Bar -->
  <path d="M 0 24 Q 0 0 24 0 L 826 0 Q 850 0 850 24 L 850 95 L 0 95 Z" fill="url(#headerGrad)"/>
  <rect y="92" width="850" height="4" fill="url(#goldTrim)"/>

  <!-- Ethiopian Emblem / Crest -->
  <g transform="translate(24, 14)">
    <circle cx="32" cy="32" r="30" fill="#0F172A" stroke="#F59E0B" stroke-width="2"/>
    <!-- Sunburst Crest -->
    <path d="M32 8 L35 22 L49 20 L38 29 L45 42 L32 35 L19 42 L26 29 L15 20 L29 22 Z" fill="#FBBF24"/>
    <circle cx="32" cy="32" r="10" fill="#1E3A8A" stroke="#F59E0B" stroke-width="1.5"/>
    <polygon points="32,25 34,31 40,31 35,35 37,41 32,37 27,41 29,35 24,31 30,31" fill="#FCD34D"/>
  </g>

  <!-- Header Text -->
  <text x="100" y="32" fill="#F8FAFC" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" letter-spacing="0.5">የኢትዮጵያ ፌዴራላዊ ዲሞክራሲያዊ ሪፐብሊክ • የትራንስፖርት እና ሎጂስቲክስ ሚኒስቴር</text>
  <text x="100" y="52" fill="#93C5FD" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="800" letter-spacing="1">FEDERAL DEMOCRATIC REPUBLIC OF ETHIOPIA</text>
  <text x="100" y="74" fill="#FCD34D" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="900" letter-spacing="1.2">COMMERCIAL DRIVER&apos;S LICENSE / የንግድ አሽከርካሪ መንጃ ፈቃድ</text>

  <!-- Holographic Optical Security Badge -->
  <g transform="translate(735, 16)">
    <rect width="90" height="62" rx="10" fill="url(#hologramGrad)" stroke="#FFFFFF" stroke-width="1.5" filter="url(#shadow)"/>
    <text x="45" y="26" text-anchor="middle" fill="#0F172A" font-family="sans-serif" font-size="10" font-weight="900">FDRE • FTA</text>
    <text x="45" y="42" text-anchor="middle" fill="#1E3A8A" font-family="sans-serif" font-size="9" font-weight="800">ሕጋዊ ማረጋገጫ</text>
    <text x="45" y="54" text-anchor="middle" fill="#0F172A" font-family="sans-serif" font-size="8" font-weight="700">VERIFIED</text>
  </g>

  <!-- Watermark in Background -->
  <text x="490" y="320" text-anchor="middle" fill="#CBD5E1" fill-opacity="0.25" font-family="sans-serif" font-size="64" font-weight="900" transform="rotate(-15 490 320)">FEDERAL TRANSPORT</text>

  <!-- Left Column: Driver Photo Box -->
  <g transform="translate(30, 115)">
    <!-- Photo Frame -->
    <rect width="185" height="240" rx="14" fill="#FFFFFF" stroke="#94A3B8" stroke-width="2" filter="url(#shadow)"/>
    <rect x="6" y="6" width="173" height="228" rx="10" fill="#E0F2FE"/>

    <!-- Realistic Driver Silhouette / Portrait -->
    <clipPath id="photoClip">
      <rect x="6" y="6" width="173" height="228" rx="10"/>
    </clipPath>
    <g clip-path="url(#photoClip)">
      <!-- Studio Backdrop -->
      <radialGradient id="studioLight" cx="50%" cy="35%" r="60%">
        <stop offset="0%" stop-color="#BAE6FD"/>
        <stop offset="100%" stop-color="#38BDF8"/>
      </radialGradient>
      <rect x="6" y="6" width="173" height="228" fill="url(#studioLight)"/>

      <!-- Driver Torso (Navy Blue Uniform Collar) -->
      <path d="M 20 234 L 166 234 L 155 165 L 125 155 L 105 185 L 80 185 L 60 155 L 30 165 Z" fill="#1E293B"/>
      <!-- Inner White Shirt / Tie -->
      <polygon points="92,155 105,185 80,185" fill="#FFFFFF"/>
      <polygon points="90,170 95,170 93,210 91,210" fill="#DC2626"/>
      <!-- Neck -->
      <rect x="78" y="125" width="30" height="35" rx="6" fill="#8D5B4C"/>
      <!-- Head / Face -->
      <ellipse cx="93" cy="95" rx="35" ry="42" fill="#9C6653"/>
      <!-- Hair -->
      <path d="M 58 85 Q 93 42 128 85 Q 120 60 93 60 Q 66 60 58 85 Z" fill="#18181B"/>
      <!-- Eyes & Smile -->
      <circle cx="82" cy="92" r="3.5" fill="#18181B"/>
      <circle cx="104" cy="92" r="3.5" fill="#18181B"/>
      <path d="M 83 115 Q 93 124 103 115" stroke="#451A03" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <ellipse cx="93" cy="102" rx="4" ry="5" fill="#78350F" fill-opacity="0.3"/>
    </g>

    <!-- Official Red Verification Seal Stamped Over Photo Edge -->
    <g transform="translate(130, 180)">
      <circle cx="35" cy="35" r="38" fill="none" stroke="#DC2626" stroke-width="2.5" stroke-dasharray="4,2"/>
      <circle cx="35" cy="35" r="30" fill="#FEF2F2" fill-opacity="0.85" stroke="#DC2626" stroke-width="1.5"/>
      <text x="35" y="24" text-anchor="middle" fill="#DC2626" font-family="sans-serif" font-size="6.5" font-weight="900">MINISTRY OF TRANSPORT</text>
      <text x="35" y="38" text-anchor="middle" fill="#DC2626" font-family="sans-serif" font-size="10" font-weight="900">★ VERIFIED ★</text>
      <text x="35" y="50" text-anchor="middle" fill="#DC2626" font-family="sans-serif" font-size="6.5" font-weight="800">ትራንስፖርት ቢሮ</text>
    </g>

    <!-- Micro-text Security String -->
    <text x="93" y="249" text-anchor="middle" fill="#64748B" font-family="monospace" font-size="7.5" letter-spacing="1">ETH-FTA-SECURE-BIOMETRIC-ID</text>
  </g>

  <!-- Golden EMV Smart Microchip Graphic -->
  <g transform="translate(30, 380)">
    <rect width="68" height="50" rx="8" fill="url(#chipGrad)" stroke="#B45309" stroke-width="1.5" filter="url(#shadow)"/>
    <line x1="0" y1="25" x2="68" y2="25" stroke="#78350F" stroke-width="1"/>
    <line x1="25" y1="0" x2="25" y2="50" stroke="#78350F" stroke-width="1"/>
    <line x1="43" y1="0" x2="43" y2="50" stroke="#78350F" stroke-width="1"/>
    <circle cx="34" cy="25" r="9" fill="none" stroke="#78350F" stroke-width="1.2"/>
  </g>

  <!-- Driver Signature Box -->
  <g transform="translate(112, 380)">
    <rect width="103" height="50" rx="8" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1"/>
    <!-- Stylized Signature of Tesfahun Nigus -->
    <path d="M 10 32 Q 22 15 35 28 T 60 22 T 85 32 Q 95 20 100 24" fill="none" stroke="#1E3A8A" stroke-width="2" stroke-linecap="round"/>
    <text x="51" y="44" text-anchor="middle" fill="#94A3B8" font-family="sans-serif" font-size="7" font-weight="600">HOLDER SIGNATURE</text>
  </g>

  <!-- Main Information Block -->
  <g transform="translate(245, 115)">
    <!-- 1. Surname -->
    <text x="0" y="12" fill="#64748B" font-family="sans-serif" font-size="9" font-weight="700" letter-spacing="0.5">1. SURNAME / የአያት ስም</text>
    <text x="0" y="32" fill="#0F172A" font-family="sans-serif" font-size="18" font-weight="900" letter-spacing="0.5">${lastName}</text>

    <!-- 2. Given Name -->
    <text x="280" y="12" fill="#64748B" font-family="sans-serif" font-size="9" font-weight="700" letter-spacing="0.5">2. GIVEN NAMES / የመጀመሪያ ስም</text>
    <text x="280" y="32" fill="#0F172A" font-family="sans-serif" font-size="18" font-weight="900" letter-spacing="0.5">${firstName}</text>

    <!-- Divider Line -->
    <line x1="0" y1="45" x2="575" y2="45" stroke="#E2E8F0" stroke-width="1.2"/>

    <!-- 3. Date of Birth & Gender -->
    <text x="0" y="65" fill="#64748B" font-family="sans-serif" font-size="9" font-weight="700">3. DATE OF BIRTH / የትውልድ ቀን</text>
    <text x="0" y="83" fill="#0F172A" font-family="sans-serif" font-size="14" font-weight="700">14/08/1988</text>

    <text x="170" y="65" fill="#64748B" font-family="sans-serif" font-size="9" font-weight="700">SEX / ፆታ</text>
    <text x="170" y="83" fill="#0F172A" font-family="sans-serif" font-size="14" font-weight="700">MALE (M)</text>

    <text x="280" y="65" fill="#64748B" font-family="sans-serif" font-size="9" font-weight="700">NATIONALITY / ዜግነት</text>
    <text x="280" y="83" fill="#0F172A" font-family="sans-serif" font-size="14" font-weight="700">ETHIOPIAN (ኢትዮጵያዊ)</text>

    <!-- Divider Line -->
    <line x1="0" y1="96" x2="575" y2="96" stroke="#E2E8F0" stroke-width="1.2"/>

    <!-- 4a. Issue Date & 4b. Expiry Date -->
    <text x="0" y="116" fill="#64748B" font-family="sans-serif" font-size="9" font-weight="700">4a. ISSUE DATE / የተሰጠበት</text>
    <text x="0" y="134" fill="#0F172A" font-family="sans-serif" font-size="14" font-weight="700">${issueDate}</text>

    <text x="170" y="116" fill="#64748B" font-family="sans-serif" font-size="9" font-weight="700">4b. EXPIRY DATE / የሚያበቃበት</text>
    <text x="170" y="134" fill="#059669" font-family="sans-serif" font-size="14" font-weight="800">${expiryDate} (VALID)</text>

    <text x="350" y="116" fill="#64748B" font-family="sans-serif" font-size="9" font-weight="700">4c. ISSUING AUTHORITY / የሰጠው</text>
    <text x="350" y="134" fill="#0F172A" font-family="sans-serif" font-size="13" font-weight="700">FTA Addis Ababa Registry</text>

    <!-- Divider Line -->
    <line x1="0" y1="148" x2="575" y2="148" stroke="#E2E8F0" stroke-width="1.2"/>

    <!-- 5. License Number (Highlight Box) -->
    <rect x="0" y="160" width="320" height="52" rx="10" fill="#EFF6FF" stroke="#3B82F6" stroke-width="1.5"/>
    <text x="14" y="177" fill="#1D4ED8" font-family="sans-serif" font-size="9" font-weight="800" letter-spacing="0.5">5. LICENSE NUMBER / የመንጃ ፈቃድ ቁጥር</text>
    <text x="14" y="200" fill="#1E3A8A" font-family="monospace" font-size="18" font-weight="900" letter-spacing="1.5">${licenseNum}</text>

    <!-- 8. Address -->
    <g transform="translate(335, 160)">
      <text x="0" y="14" fill="#64748B" font-family="sans-serif" font-size="9" font-weight="700">8. RESIDENCE / የመኖሪያ አድራሻ</text>
      <text x="0" y="32" fill="#0F172A" font-family="sans-serif" font-size="13" font-weight="600">Bole Sub-City, Woreda 03</text>
      <text x="0" y="47" fill="#475569" font-family="sans-serif" font-size="12" font-weight="500">Addis Ababa, Ethiopia</text>
    </g>

    <!-- 9. Commercial Category Classification -->
    <g transform="translate(0, 224)">
      <rect width="575" height="52" rx="10" fill="#FEF3C7" stroke="#F59E0B" stroke-width="1.5"/>
      <g transform="translate(14, 12)">
        <text x="0" y="12" fill="#92400E" font-family="sans-serif" font-size="9" font-weight="800" letter-spacing="0.5">9. CATEGORY / ደረጃ</text>
        <text x="0" y="28" fill="#78350F" font-family="sans-serif" font-size="14" font-weight="900">ሕዝብ 3 / PUBLIC-3</text>
      </g>
      <g transform="translate(150, 12)">
        <text x="0" y="12" fill="#92400E" font-family="sans-serif" font-size="9" font-weight="800" letter-spacing="0.5">AUTHORIZED VEHICLE CLASS / የተፈቀደው የተሽከርካሪ ዓይነት</text>
        <text x="0" y="28" fill="#1E293B" font-family="sans-serif" font-size="13" font-weight="700">Commercial Minibus, School Bus &amp; Passenger Transit (&lt; 30 Seats)</text>
      </g>
    </g>
  </g>

  <!-- Bottom Machine Readable Zone (MRZ) & Barcode Band -->
  <g transform="translate(0, 448)">
    <path d="M 0 0 L 850 0 L 850 68 Q 850 92 826 92 L 24 92 Q 0 92 0 68 Z" fill="#0F172A"/>

    <!-- High-density 2D Security Barcode -->
    <g transform="translate(24, 14)">
      <!-- Simulated PDF417 / Aztec 2D Barcode pattern -->
      <rect width="130" height="56" rx="4" fill="#FFFFFF"/>
      <g fill="#0F172A">
        <rect x="4" y="4" width="4" height="48"/>
        <rect x="11" y="4" width="2" height="48"/>
        <rect x="15" y="4" width="6" height="48"/>
        <rect x="24" y="4" width="3" height="48"/>
        <rect x="30" y="4" width="5" height="48"/>
        <rect x="38" y="4" width="2" height="48"/>
        <rect x="43" y="4" width="7" height="48"/>
        <rect x="53" y="4" width="3" height="48"/>
        <rect x="59" y="4" width="6" height="48"/>
        <rect x="68" y="4" width="2" height="48"/>
        <rect x="73" y="4" width="4" height="48"/>
        <rect x="80" y="4" width="8" height="48"/>
        <rect x="91" y="4" width="3" height="48"/>
        <rect x="97" y="4" width="5" height="48"/>
        <rect x="105" y="4" width="2" height="48"/>
        <rect x="110" y="4" width="6" height="48"/>
        <rect x="119" y="4" width="2" height="48"/>
        <rect x="123" y="4" width="4" height="48"/>
      </g>
    </g>

    <!-- OCR-B Machine-Readable Lines -->
    <g transform="translate(170, 26)">
      <text x="0" y="14" fill="#E2E8F0" font-family="'Courier New', Courier, monospace" font-size="15" font-weight="700" letter-spacing="3.5">D1ETH${doc.id.replace(/-/g, '').substring(0, 10).toUpperCase()}&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text>
      <text x="0" y="38" fill="#E2E8F0" font-family="'Courier New', Courier, monospace" font-size="15" font-weight="700" letter-spacing="3.5">8808144M2810227ETH&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;02${lastName}&lt;&lt;${firstName}</text>
    </g>

    <!-- SchoolSafe Cryptographic Stamp -->
    <g transform="translate(735, 18)">
      <rect width="90" height="48" rx="8" fill="#1E293B" stroke="#3B82F6" stroke-width="1"/>
      <text x="45" y="20" text-anchor="middle" fill="#60A5FA" font-family="sans-serif" font-size="8" font-weight="700">SchoolSafe</text>
      <text x="45" y="34" text-anchor="middle" fill="#34D399" font-family="monospace" font-size="9" font-weight="900">VERIFIED</text>
    </g>
  </g>
</svg>`;
}

/**
 * Generates an authentic Ethiopian Vehicle Registration / Libre SVG
 */
export function generateVehicleLibreSvg(doc: DocumentData, user: UserData): string {
  const ownerName = escapeXml(`${(user.firstName || 'Tesfahun').toUpperCase()} ${(user.lastName || 'Nigus').toUpperCase()}`);
  const vin = `ET-TY-2021-${doc.id.replace(/-/g, '').substring(0, 8).toUpperCase()}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 540" width="100%" height="auto" style="border-radius: 20px; box-shadow: 0 20px 40px -15px rgba(15, 23, 42, 0.25);">
  <defs>
    <linearGradient id="cardBgLibre" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F0FDF4"/>
      <stop offset="50%" stop-color="#ECFDF5"/>
      <stop offset="100%" stop-color="#D1FAE5"/>
    </linearGradient>
    <linearGradient id="headerGradLibre" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#064E3B"/>
      <stop offset="50%" stop-color="#047857"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <linearGradient id="goldTrim" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#F59E0B"/>
      <stop offset="50%" stop-color="#FCD34D"/>
      <stop offset="100%" stop-color="#D97706"/>
    </linearGradient>
  </defs>

  <!-- Frame -->
  <rect width="850" height="540" rx="24" fill="url(#cardBgLibre)" stroke="#A7F3D0" stroke-width="2"/>

  <!-- Header -->
  <path d="M 0 24 Q 0 0 24 0 L 826 0 Q 850 0 850 24 L 850 95 L 0 95 Z" fill="url(#headerGradLibre)"/>
  <rect y="92" width="850" height="4" fill="url(#goldTrim)"/>

  <text x="40" y="36" fill="#D1FAE5" font-family="sans-serif" font-size="13" font-weight="700">የኢትዮጵያ ፌዴራላዊ ዲሞክራሲያዊ ሪፐብሊክ የትራንስፖርት ባለስልጣን</text>
  <text x="40" y="58" fill="#FFFFFF" font-family="sans-serif" font-size="15" font-weight="900">FEDERAL TRANSPORT AUTHORITY - VEHICLE TITLE &amp; REGISTRATION (LIBRE / ሊብሬ)</text>
  <text x="40" y="78" fill="#FDE68A" font-family="sans-serif" font-size="12" font-weight="700">OFFICIAL COMMERCIAL MOTOR VEHICLE REGISTRATION CERTIFICATE</text>

  <!-- Content Box -->
  <g transform="translate(40, 120)">
    <!-- Plate Number Banner -->
    <rect width="360" height="70" rx="12" fill="#FFFFFF" stroke="#047857" stroke-width="2"/>
    <text x="20" y="24" fill="#065F46" font-family="sans-serif" font-size="10" font-weight="800">COMMERCIAL PLATE NUMBER / የሰሌዳ ቁጥር</text>
    <text x="20" y="56" fill="#064E3B" font-family="sans-serif" font-size="28" font-weight="900" letter-spacing="2">3 - 48291 AA</text>

    <!-- QR / Barcode -->
    <g transform="translate(390, 0)">
      <rect width="380" height="70" rx="12" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5"/>
      <text x="20" y="24" fill="#64748B" font-family="sans-serif" font-size="10" font-weight="800">CHASSIS / VIN NUMBER</text>
      <text x="20" y="52" fill="#0F172A" font-family="monospace" font-size="17" font-weight="900">${vin}</text>
    </g>

    <!-- Details Grid -->
    <g transform="translate(0, 90)">
      <rect width="770" height="210" rx="14" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>

      <g transform="translate(24, 28)">
        <text x="0" y="0" fill="#64748B" font-size="10" font-weight="700">REGISTERED OWNER / የባለቤቱ ስም</text>
        <text x="0" y="24" fill="#0F172A" font-size="16" font-weight="900">${ownerName}</text>

        <text x="360" y="0" fill="#64748B" font-size="10" font-weight="700">VEHICLE MAKE &amp; MODEL / የተሽከርካሪው ዓይነት</text>
        <text x="360" y="24" fill="#0F172A" font-size="16" font-weight="900">TOYOTA HIACE COMMUTER (MINIBUS)</text>

        <text x="0" y="70" fill="#64748B" font-size="10" font-weight="700">BODY TYPE / የተሽከርካሪ ቅርፅ</text>
        <text x="0" y="92" fill="#0F172A" font-size="15" font-weight="800">PASSENGER TRANSIT VAN / MINIBUS</text>

        <text x="360" y="70" fill="#64748B" font-size="10" font-weight="700">SEATING CAPACITY / የመጫን አቅም</text>
        <text x="360" y="92" fill="#059669" font-size="16" font-weight="900">15 PASSENGERS (STUDENTS)</text>

        <text x="0" y="140" fill="#64748B" font-size="10" font-weight="700">COLOR / ቀለም</text>
        <text x="0" y="162" fill="#0F172A" font-size="15" font-weight="800">WHITE &amp; BLUE (ሰማያዊ ነጭ)</text>

        <text x="360" y="140" fill="#64748B" font-size="10" font-weight="700">FUEL TYPE / የነዳጅ ዓይነት</text>
        <text x="360" y="162" fill="#0F172A" font-size="15" font-weight="800">DIESEL (ናፍጣ)</text>
      </g>
    </g>
  </g>

  <!-- Footer Seal -->
  <g transform="translate(0, 448)">
    <path d="M 0 0 L 850 0 L 850 68 Q 850 92 826 92 L 24 92 Q 0 92 0 68 Z" fill="#064E3B"/>
    <text x="425" y="38" text-anchor="middle" fill="#A7F3D0" font-family="sans-serif" font-size="13" font-weight="700">
      AUTHENTICATED FOR COMMERCIAL SCHOOL TRANSPORT SERVICE • SCHOOLSAFE REGISTRY
    </text>
    <text x="425" y="60" text-anchor="middle" fill="#FFFFFF" font-family="monospace" font-size="11" font-weight="800">
      RECORD HASH: ${doc.id.toUpperCase()} • COMPLIANT
    </text>
  </g>
</svg>`;
}

/**
 * Generates an authentic Business / Commercial Transport Registration SVG
 */
export function generateBusinessRegistrationSvg(doc: DocumentData, user: UserData): string {
  const businessName = escapeXml(
    (user.businessName || `${user.firstName || 'Tesfahun'} ${user.lastName || 'Nigus'} Transit Services`).toUpperCase()
  );
  const tin = `00${doc.id.replace(/\D/g, '').padEnd(8, '491823').substring(0, 8)}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 540" width="100%" height="auto" style="border-radius: 20px; box-shadow: 0 20px 40px -15px rgba(15, 23, 42, 0.25);">
  <defs>
    <linearGradient id="cardBgBiz" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFBEB"/>
      <stop offset="50%" stop-color="#FEF3C7"/>
      <stop offset="100%" stop-color="#FDE68A"/>
    </linearGradient>
    <linearGradient id="headerGradBiz" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#78350F"/>
      <stop offset="50%" stop-color="#92400E"/>
      <stop offset="100%" stop-color="#B45309"/>
    </linearGradient>
    <linearGradient id="goldTrim" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#F59E0B"/>
      <stop offset="50%" stop-color="#FCD34D"/>
      <stop offset="100%" stop-color="#D97706"/>
    </linearGradient>
  </defs>

  <rect width="850" height="540" rx="24" fill="url(#cardBgBiz)" stroke="#F59E0B" stroke-width="2"/>
  <path d="M 0 24 Q 0 0 24 0 L 826 0 Q 850 0 850 24 L 850 95 L 0 95 Z" fill="url(#headerGradBiz)"/>
  <rect y="92" width="850" height="4" fill="url(#goldTrim)"/>

  <text x="40" y="36" fill="#FDE68A" font-family="sans-serif" font-size="13" font-weight="700">የኢትዮጵያ ፌዴራላዊ ዲሞክራሲያዊ ሪፐብሊክ የንግድ እና ቀጣናዊ ትስስር ሚኒስቴር</text>
  <text x="40" y="58" fill="#FFFFFF" font-family="sans-serif" font-size="15" font-weight="900">MINISTRY OF TRADE &amp; REGIONAL INTEGRATION - COMMERCIAL REGISTRATION</text>
  <text x="40" y="78" fill="#FEF3C7" font-family="sans-serif" font-size="12" font-weight="700">COMMERCIAL TRANSPORT OPERATOR CERTIFICATE / የንግድ ምዝገባ ምስክር ወረቀት</text>

  <g transform="translate(40, 120)">
    <rect width="770" height="300" rx="14" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>

    <g transform="translate(30, 36)">
      <text x="0" y="0" fill="#92400E" font-size="11" font-weight="800">BUSINESS / TRADE NAME (የንግድ ስም)</text>
      <text x="0" y="28" fill="#1E293B" font-size="20" font-weight="900">${businessName}</text>

      <line x1="0" y1="46" x2="710" y2="46" stroke="#FEF3C7" stroke-width="2"/>

      <text x="0" y="74" fill="#92400E" font-size="11" font-weight="800">TAX IDENTIFICATION NUMBER (TIN / የግብር ከፋይ መለያ ቁጥር)</text>
      <text x="0" y="100" fill="#1E3A8A" font-family="monospace" font-size="18" font-weight="900">${tin}</text>

      <text x="360" y="74" fill="#92400E" font-size="11" font-weight="800">PRINCIPAL REGISTRATION NO. (ዋና ምዝገባ ቁጥር)</text>
      <text x="360" y="100" fill="#0F172A" font-family="monospace" font-size="18" font-weight="900">AA/BOL/02/0948/2024</text>

      <line x1="0" y1="124" x2="710" y2="124" stroke="#FEF3C7" stroke-width="2"/>

      <text x="0" y="152" fill="#92400E" font-size="11" font-weight="800">REGISTERED BUSINESS SECTOR (የንግድ ዘርፍ)</text>
      <text x="0" y="176" fill="#0F172A" font-size="15" font-weight="800">Student &amp; Educational Passenger Road Transport Services</text>

      <text x="0" y="212" fill="#92400E" font-size="11" font-weight="800">REGISTERED OFFICE ADDRESS (ዋና መስሪያ ቤት አድራሻ)</text>
      <text x="0" y="234" fill="#475569" font-size="14" font-weight="600">Bole Sub-City, Commercial Building Suite 302, Addis Ababa, Ethiopia</text>
    </g>
  </g>

  <g transform="translate(0, 448)">
    <path d="M 0 0 L 850 0 L 850 68 Q 850 92 826 92 L 24 92 Q 0 92 0 68 Z" fill="#78350F"/>
    <text x="425" y="48" text-anchor="middle" fill="#FEF3C7" font-family="sans-serif" font-size="13" font-weight="700">
      OFFICIALLY ISSUED UNDER COMMERCIAL CODE OF ETHIOPIA • VERIFIED BY SCHOOLSAFE
    </text>
  </g>
</svg>`;
}

/**
 * Returns the appropriate SVG string based on documentType
 */
export function generateDocumentVisualSvg(doc: DocumentData, user: UserData): string {
  const type = (doc.documentType || '').toUpperCase();
  if (type.includes('DRIVER') || type.includes('LICENSE')) {
    return generateDriverLicenseSvg(doc, user);
  }
  if (type.includes('VEHICLE') || type.includes('LIBRE') || type.includes('REGISTRATION')) {
    return generateVehicleLibreSvg(doc, user);
  }
  if (type.includes('BUSINESS') || type.includes('COMMERCIAL') || type.includes('PERMIT')) {
    return generateBusinessRegistrationSvg(doc, user);
  }
  return generateDriverLicenseSvg(doc, user);
}
