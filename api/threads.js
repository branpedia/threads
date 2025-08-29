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
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'URL parameter is required'
    });
  }

  // Validasi URL
  if (!(url.includes('threads.net') || url.includes('threads.com')) || !url.includes('/post/')) {
    return res.status(400).json({
      success: false,
      error: 'URL Threads tidak valid. Pastikan URL mengandung threads.net/threads.com dan /post/'
    });
  }

  try {
    // Ekstrak ID post dari URL
    const postId = extractPostId(url);
    if (!postId) {
      return res.status(400).json({
        success: false,
        error: 'Gagal mengekstrak ID post dari URL'
      });
    }

    console.log(`Mencoba mengambil data untuk post ID: ${postId}`);
    
    // Coba server 1 (dolphinradar) terlebih dahulu
    let data = await tryServer1(postId);
    
    // Jika server 1 gagal, coba server 2
    if (!data) {
      console.log('Server 1 gagal, mencoba Server 2');
      data = await tryServer2(url);
    }

    // Jika kedua server gagal
    if (!data) {
      return res.status(500).json({
        success: false,
        error: 'Tidak dapat mengambil data dari server manapun'
      });
    }

    // Format response
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('Error fetching threads data:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Terjadi kesalahan saat mengambil data: ' + error.message
    });
  }
}

// Fungsi untuk mengekstrak ID post dari URL
function extractPostId(url) {
  try {
    // Ekstrak bagian setelah /post/
    const postMatch = url.match(/\/post\/([^\/\?]+)/);
    if (postMatch && postMatch[1]) {
      return postMatch[1];
    }
    return null;
  } catch (e) {
    console.error('Error extracting post ID:', e);
    return null;
  }
}

async function tryServer1(postId) {
  try {
    console.log(`Mencoba Server 1 dengan ID: ${postId}`);
    
    // Gunakan API dolphinradar untuk mendapatkan data threads
    const response = await axios.get(`https://www.dolphinradar.com/api/threads/post_detail/${postId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.dolphinradar.com/'
      },
      timeout: 15000
    });

    console.log('Server 1 response status:', response.status);
    
    if (response.data && response.data.code === 0 && response.data.data) {
      const data = response.data.data;
      
      // Format data untuk konsistensi
      return {
        username: data.user?.username || '',
        full_name: data.user?.full_name || '',
        avatar: data.user?.avatar || '',
        follower_count: data.user?.follower_count || 0,
        verified: data.user?.verified || false,
        caption: data.post_detail?.caption_text || '',
        likes: data.post_detail?.like_count || 0,
        publish_time: data.post_detail?.publish_time || '',
        media: data.post_detail?.media_list ? data.post_detail.media_list.map(media => ({
          type: media.media_type === 2 ? 'video' : 'image',
          url: media.url || '',
          cover_image: media.cover_image || ''
        })) : []
      };
    } else {
      console.log('Server 1 response tidak valid:', response.data);
      return null;
    }
    
  } catch (error) {
    console.log('Server 1 gagal:', error.message);
    return null;
  }
}

async function tryServer2(url) {
  try {
    console.log(`Mencoba Server 2 dengan URL: ${url}`);
    
    // Gunakan API alternatif untuk mendapatkan data threads
    const response = await axios.get('https://threads-downloader-api.vercel.app/threads', {
      params: { 
        url: url 
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json'
      },
      timeout: 15000
    });

    console.log('Server 2 response status:', response.status);
    
    if (response.data && response.data.success && response.data.data) {
      const data = response.data.data;
      
      // Format data untuk konsistensi dengan server 1
      return {
        username: data.author?.username || data.author_username || '',
        full_name: data.author?.full_name || data.author_full_name || '',
        avatar: data.author?.profile_pic_url || data.author_profile_pic_url || '',
        follower_count: data.author?.follower_count || 0,
        verified: data.author?.is_verified || false,
        caption: data.caption || data.caption_text || '',
        likes: data.likes_count || 0,
        publish_time: data.taken_at || data.publish_time || '',
        media: data.media || data.media_list || []
      };
    } else {
      console.log('Server 2 response tidak valid:', response.data);
      return null;
    }
    
  } catch (error) {
    console.log('Server 2 gagal:', error.message);
    
    // Coba fallback ke API lain jika server 2 juga gagal
    try {
      console.log('Mencoba fallback API...');
      const fallbackResponse = await axios.get(`https://api.threadsdownload.com/download`, {
        params: { url },
        timeout: 10000
      });
      
      if (fallbackResponse.data && fallbackResponse.data.media) {
        return {
          username: fallbackResponse.data.author_username || '',
          full_name: fallbackResponse.data.author_name || '',
          avatar: fallbackResponse.data.author_picture || '',
          caption: fallbackResponse.data.caption || '',
          likes: fallbackResponse.data.likes || 0,
          publish_time: fallbackResponse.data.date || '',
          media: fallbackResponse.data.media.map(m => ({
            type: m.type || 'image',
            url: m.url || '',
            cover_image: m.thumbnail || ''
          }))
        };
      }
    } catch (fallbackError) {
      console.log('Fallback API juga gagal:', fallbackError.message);
    }
    
    return null;
  }
}
