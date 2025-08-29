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
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ success: false, error: 'URL parameter is required' });
  }

  // Validasi URL
  if (!(url.includes('threads.net') || url.includes('threads.com')) || !url.includes('/post/')) {
    return res.status(400).json({ success: false, error: 'URL Threads tidak valid. Pastikan URL mengandung threads.net/threads.com dan /post/' });
  }

  try {
    // Ekstrak ID post dari URL (termasuk parameter query jika ada)
    const postIdWithParams = extractPostIdWithParams(url);
    if (!postIdWithParams) {
      return res.status(400).json({ success: false, error: 'Gagal mengekstrak ID post dari URL' });
    }

    // Gunakan server dolphinradar
    const result = await tryDolphinRadar(postIdWithParams);
    
    if (result) {
      return res.status(200).json({
        success: true,
        data: result
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        error: 'Gagal mengambil data dari semua server' 
      });
    }
  } catch (error) {
    console.error('Error fetching threads data:', error.message);
    return res.status(500).json({ 
      success: false, 
      error: 'Terjadi kesalahan saat mengambil data: ' + error.message 
    });
  }
}

// Fungsi untuk mengekstrak ID post beserta parameter dari URL
function extractPostIdWithParams(url) {
  try {
    // Ekstrak bagian setelah /post/ termasuk parameter query
    const postMatch = url.match(/\/post\/([^?]+)?(\?.*)?/);
    if (postMatch && postMatch[1]) {
      // Gabungkan ID post dengan parameter query jika ada
      let fullId = postMatch[1];
      if (postMatch[2]) {
        fullId += postMatch[2];
      }
      return fullId;
    }
    return null;
  } catch (e) {
    console.error('Error extracting post ID:', e);
    return null;
  }
}

// Fungsi untuk mencoba server DolphinRadar
async function tryDolphinRadar(postIdWithParams) {
  try {
    console.log(`Mencoba DolphinRadar dengan ID: ${postIdWithParams}`);
    
    const apiUrl = `https://www.dolphinradar.com/api/threads/post_detail/${postIdWithParams}`;
    const response = await axios.get(apiUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (response.data && response.data.code === 0) {
      return response.data;
    } else {
      throw new Error('Response format tidak valid dari DolphinRadar');
    }
  } catch (error) {
    console.log('DolphinRadar gagal:', error.message);
    return null;
  }
}
