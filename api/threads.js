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

  // Validasi URL - perbaikan di sini
  if (!(url.includes('threads.net') || url.includes('threads.com')) || !url.includes('/post/')) {
    return res.status(400).json({ 
      success: false,
      error: 'URL Threads tidak valid. Pastikan URL mengandung threads.net/threads.com dan /post/' 
    });
  }

  try {
    // Normalisasi URL - ubah threads.com menjadi threads.net
    let normalizedUrl = url;
    if (url.includes('threads.com')) {
      normalizedUrl = url.replace('threads.com', 'threads.net');
    }
    
    // Ekstrak ID post dari URL
    const postIdMatch = normalizedUrl.match(/\/post\/([a-zA-Z0-9_-]+)/);
    if (!postIdMatch || !postIdMatch[1]) {
      return res.status(400).json({ 
        success: false,
        error: 'Gagal mengekstrak ID post dari URL' 
      });
    }
    
    const postId = postIdMatch[1];
    
    // Coba server 1 (dolphinradar) terlebih dahulu
    let data = await tryServer1(postId);
    
    // Jika server 1 gagal, coba server 2 (threadsphotodownloader)
    if (!data) {
      data = await tryServer2(normalizedUrl);
    }
    
    if (!data) {
      return res.status(500).json({ 
        success: false,
        error: 'Kedua server tidak merespons. Silakan coba lagi nanti.' 
      });
    }
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    // Kembalikan data dalam format JSON
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

    const data = response.data;

    if (data.code !== 0 || !data.data) {
      throw new Error('Data tidak valid dari server 1');
    }
    
    // Format data untuk response
    return {
      user: {
        username: data.data.user.username,
        full_name: data.data.user.full_name,
        avatar: data.data.user.avatar,
        follower_count: data.data.user.follower_count,
        verified: data.data.user.verified
      },
      caption: data.data.post_detail.caption_text,
      likes: data.data.post_detail.like_count,
      publish_time: data.data.post_detail.publish_time,
      media: data.data.post_detail.media_list ? data.data.post_detail.media_list.map(media => ({
        type: media.media_type === 2 ? 'video' : 'image',
        url: media.url
      })) : []
    };
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
        'accept': '*/*',
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

    const data = response.data;

    // Format data untuk response
    return {
      user: {
        username: data.username || 'unknown',
        full_name: data.full_name || 'Unknown User',
        avatar: data.profile_pic || '',
        follower_count: data.followers || 0,
        verified: data.is_verified || false
      },
      caption: data.caption || '',
      likes: data.likes || 0,
      publish_time: data.timestamp || new Date().toISOString(),
      media: [
        ...(data.video_urls || []).map(video => ({ type: 'video', url: video.download_url || video.url })),
        ...(data.image_urls || []).map(image => ({ type: 'image', url: image }))
      ]
    };
  } catch (error) {
    console.log('Server 2 gagal:', error.message);
    return null;
  }
}
