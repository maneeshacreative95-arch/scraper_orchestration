const sampleBatch = [
  // Record 1: High Quality (100 pts) -> Valid
  {
    company_name: 'TechSolutions Pvt Ltd',
    phone: '+91 9876543210',
    website: 'https://techsolutions.com',
    google_maps_url: 'https://maps.google.com/?q=TechSolutions+Bangalore',
    address: '100 Feet Road, Indiranagar, Bangalore, Karnataka',
    category: 'IT Companies'
  },
  // Record 2: Good Quality (85 pts) -> Valid (Score >= 75)
  {
    company_name: 'Global AI Labs',
    phone: '080 4123 4567',
    website: 'http://globalailabs.io',
    google_maps_url: 'https://goo.gl/maps/xyz123',
    address: 'Koramangala 5th Block, Bangalore',
    category: 'Software'
  },
  // Record 3: Duplicate of Record 1 by phone -> Rejected (Duplicate)
  {
    company_name: 'TechSolutions Duplicate',
    phone: '9876543210',
    website: 'https://techsolutions-dup.com',
    google_maps_url: 'https://maps.google.com/?q=TechSolutions+Bangalore',
    address: 'Bangalore',
    category: 'IT Companies'
  },
  // Record 4: Missing Phone & Website, Short Name (Score < 75) -> Rejected
  {
    company_name: 'AI',
    phone: '',
    website: 'invalid-link-without-http',
    google_maps_url: 'https://maps.google.com/?q=AI',
    address: 'Unknown Place',
    category: 'Startups'
  }
];

function runTest() {
  console.log('--- Testing Quality Check Engine Rules ---');
  
  // Rule Evaluator
  function evaluate(records, city, state, cat) {
    const summary = { totalScraped: records.length, validCount: 0, duplicateCount: 0, rejectedCount: 0 };
    const validRecords = [];
    const failedRecords = [];
    const seenPhone = new Set();

    for (const item of records) {
      const name = String(item.company_name || '').trim();
      const rawPhone = String(item.phone || '').trim();
      const cleanPhone = rawPhone.replace(/\D/g, '');
      const website = String(item.website || '').trim();
      const mapsUrl = String(item.google_maps_url || '').trim();
      const address = String(item.address || '').trim();
      const category = String(item.category || '').trim();

      const phoneKey = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;

      if (phoneKey && seenPhone.has(phoneKey)) {
        summary.duplicateCount++;
        failedRecords.push({ company_name: name, quality_score: 0, reason: 'Duplicate phone in batch' });
        continue;
      }
      if (phoneKey) seenPhone.add(phoneKey);

      let score = 0;
      const reasons = [];

      if (name.length >= 3) score += 15; else reasons.push('Company name < 3 chars');
      if (cleanPhone.length >= 10 && cleanPhone.length <= 15) score += 20; else reasons.push('Phone invalid length');
      if (website && (website.startsWith('http://') || website.startsWith('https://'))) score += 20; else reasons.push('Website invalid format');
      if (mapsUrl && (mapsUrl.includes('google.com/maps') || mapsUrl.includes('maps.google.com') || mapsUrl.includes('goo.gl'))) score += 15; else reasons.push('Maps URL invalid');
      if (address.toLowerCase().includes(city.toLowerCase()) || address.toLowerCase().includes(state.toLowerCase())) score += 15; else reasons.push('Address missing city/state');
      if (category.toLowerCase().includes(cat.toLowerCase())) score += 15; else reasons.push('Category mismatch');

      if (score >= 75) {
        summary.validCount++;
        validRecords.push({ company_name: name, quality_score: score });
      } else {
        summary.rejectedCount++;
        failedRecords.push({ company_name: name, quality_score: score, reasons });
      }
    }

    return { summary, validRecords, failedRecords };
  }

  const result = evaluate(sampleBatch, 'Bangalore', 'Karnataka', 'IT');
  console.log('QC Test Summary:', JSON.stringify(result.summary, null, 2));
  console.log('Valid Records (Score >= 75):', result.validRecords);
  console.log('Failed Records (Score < 75 or Dup):', result.failedRecords);

  if (result.summary.validCount === 2 && result.summary.duplicateCount === 1 && result.summary.rejectedCount === 1) {
    console.log('✅ ALL QUALITY CHECK ENGINE TESTS PASSED SUCCESSFULLY!');
  } else {
    console.error('❌ Test failed expectation!');
  }
}

runTest();
