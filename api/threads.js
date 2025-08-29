import axios from 'axios';

export default async function handler(req, res) {
  // Handle preflight request for CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, id } = req.query;

  if (!url || !id) {
    return res.status(400).json({ error: 'URL and ID parameters are required' });
  }

  try {
    // Gunakan API dolphinradar untuk mendapatkan data threads
    const response = await axios.get(`https://www.dolphinradar.com/api/threads/post_detail/${id}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
        'Accept': 'application/json'
      }
    });

    const data = response.data;

    if (data.code !== 0 || !data.data) {
      return res.status(404).json({ error: 'Post tidak ditemukan atau tidak dapat diakses' });
    }

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    // Kembalikan data dalam format JSON
    res.status(200).json(data.data);
  } catch (error) {
    console.error('Error fetching threads data:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat mengambil data' });
  }
}
