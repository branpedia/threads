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

    // Coba server 1 (dolphinradar)
    let data = await tryServer1(postId);
    
    // Jika server 1 gagal, coba server 2
    if (!data) {
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
    res.status(200).json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('Error fetching threads data:', error);
    res.status(500).json({
      success: false,
      error: 'Terjadi kesalahan saat mengambil data'
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
    return null;
  }
}

async function tryServer1(postId) {
  try {
    // Gunakan API dolphinradar untuk mendapatkan data threads
    const response = await axios.get(`https://www.dolphinradar.com/api/threads/post_detail/${postId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    if (response.data && response.data.code === 0 && response.data.data) {
      const data = response.data.data;
      
      // Format data untuk konsistensi
      return {
        username: data.user?.username,
        full_name: data.user?.full_name,
        avatar: data.user?.avatar,
        follower_count: data.user?.follower_count,
        verified: data.user?.verified,
        caption: data.post_detail?.caption_text,
        likes: data.post_detail?.like_count,
        publish_time: data.post_detail?.publish_time,
        media: data.post_detail?.media_list ? data.post_detail.media_list.map(media => ({
          type: media.media_type === 2 ? 'video' : 'image',
          url: media.url,
          cover_image: media.cover_image
        })) : []
      };
    }
    
    return null;
  } catch (error) {
    console.log('Server 1 gagal:', error.message);
    return null;
  }
}

async function tryServer2(url) {
  try {
    // Gunakan API threadsphotodownloader untuk mendapatkan data threads
    const response = await axios.get('https://api.threadsphotodownloader.com/v2/media', {
      params: { url },
      headers: {
        'authority': 'api.threadsphotodownloader.com',
        'accept': '/',
        'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'origin': 'https://sssthreads.pro',
        'referer': 'https://sssthreads.pro/',
        'sec-ch-ua': '"Chromium";v="137", "Not/A)Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Linux"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site',
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });

    if (response.data && response.data.data) {
      const data = response.data.data;
      
      // Format data untuk konsistensi dengan server 1
      return {
        username: data.author?.username,
        full_name: data.author?.full_name,
        avatar: data.author?.avatar,
        follower_count: data.author?.follower_count,
        verified: data.author?.verified,
        caption: data.caption,
        likes: data.likes_count,
        publish_time: data.taken_at,
        media: data.media ? data.media.map(media => ({
          type: media.type,
          url: media.url,
          cover_image: media.thumbnail
        })) : []
      };
    }
    
    return null;
  } catch (error) {
    console.log('Server 2 gagal:', error.message);
    return null;
  }
}
