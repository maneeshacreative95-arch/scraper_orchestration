const userPrompt = "Run AI startups, software companies, IT companies, and tech startups across all major areas of Bhopal including MP Nagar, Arera Colony, Govindpura, Kolar Road, Indrapuri, and Hoshangabad Road.";

function analyzeTopic(requestText) {
  if (!requestText) return { industry: 'General', country: 'India', region: 'South India', state: '', targetContacts: 0, hasExplicitTarget: false };
  const text = requestText.toLowerCase().trim();

  let country = 'India';
  let region = '';
  let state = '';
  
  const statesList = [
    'karnataka', 'telangana', 'tamil nadu', 'kerala', 'andhra pradesh', 
    'goa', 'maharashtra', 'gujarat', 'haryana', 'punjab', 'delhi', 'west bengal',
    'rajasthan', 'uttar pradesh', 'bihar', 'odisha', 'madhya pradesh'
  ];
  for (const s of statesList) {
    if (text.includes(s)) {
      state = s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      break;
    }
  }

  if (!state) {
    const cityStateDict = {
      'bhopal': 'Madhya Pradesh', 'indore': 'Madhya Pradesh', 'gwalior': 'Madhya Pradesh', 'jabalpur': 'Madhya Pradesh',
      'bangalore': 'Karnataka', 'bengaluru': 'Karnataka', 'mumbai': 'Maharashtra', 'pune': 'Maharashtra',
      'delhi': 'Delhi', 'new delhi': 'Delhi', 'noida': 'Uttar Pradesh', 'gurgaon': 'Haryana', 'gurugram': 'Haryana'
    };
    for (const [cName, sName] of Object.entries(cityStateDict)) {
      if (text.includes(cName)) {
        state = sName;
        if (!region) region = sName;
        break;
      }
    }
  }

  const coverageScope = state || region || 'Madhya Pradesh';
  return { coverageScope, state, region };
}

const result = analyzeTopic(userPrompt);
console.log('Parsed result for Bhopal prompt:', result);

if (result.coverageScope === 'Madhya Pradesh' && result.state === 'Madhya Pradesh') {
  console.log('✅ PROMPT RESOLVES TO BHOPAL / MADHYA PRADESH CORRECTLY!');
} else {
  console.error('❌ Resolution failed!');
}
