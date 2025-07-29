async function loadFirebaseData() {
    if (!isFirebaseConnected) {
        loadLocalData();
        return;
    }

    try {
        console.log('Firebaseからデータを読み込み中...');
        
        const postsSnapshot = await db.collection('posts')
            .orderBy('timestamp', 'desc')
            .limit(200)
            .get();

        allPosts = [];
        postsSnapshot.forEach(doc => {
            const data = doc.data();
            const post = { 
                id: doc.id, 
                ...data,
                timestamp: data.timestamp?.toDate?.()?.getTime() || data.clientTimestamp || Date.now()
            };
            allPosts.push(post);
            addPostToMap(post);
        });

        console.log(`${allPosts.length}件の投稿を読み込みました`);
        
        updateStatistics();
        updateRealtimeFeed();
        updateDataAnalytics();
        updateUserStats();

    } catch (error) {
        console.error('Firebase データ読み込みエラー:', error);
        
        if (error.code === 'permission-denied') {
            showAlert('データベースの権限設定を確認してください。ローカルモードで動作します。', 'warning');
            isFirebaseConnected = false;
        } else {
            showAlert('データの読み込みに失敗しました。ローカルモードで動作します。', 'warning');
        }
        
        loadLocalData();
    }
}

function loadLocalData() {
    allPosts = JSON.parse(localStorage.getItem('positive_map_posts') || '[]');
    
    allPosts.forEach(post => {
        addPostToMap(post);
    });
    
    updateStatistics();
    updateRealtimeFeed();
    updateDataAnalytics();
    updateUserStats();
}

function addPostToMap(post) {
    if (currentFilter && post.emotion !== currentFilter) {
        return; // フィルター適用時は該当する感情のみ表示
    }
    
    const emotionEmojis = {
        happy: '😊',
        love: '❤️',
        excited: '🎉',
        grateful: '🙏'
    };

    const customIcon = L.divIcon({
        html: `<div style="
            background: linear-gradient(45deg, #6366f1, #06b6d4);
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            border: 2px solid white;
            box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
        ">${emotionEmojis[post.emotion]}</div>`,
        className: 'custom-marker',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
    });

    const marker = L.marker([post.location.lat, post.location.lng], { icon: customIcon })
        .bindPopup(`
            <div style="text-align: center; padding: 12px; min-width: 150px;">
                <div style="font-size: 28px; margin-bottom: 8px;">
                    ${emotionEmojis[post.emotion]}
                </div>
                <div style="font-weight: 600; margin-bottom: 8px; color: #1f2937;">
                    ${translations[currentLang]['emotion_' + post.emotion] || post.emotion}
                </div>
                ${post.message ? `<div style="font-style: italic; margin-bottom: 8px; color: #6b7280; line-height: 1.4;">"${post.message}"</div>` : ''}
                <div style="font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px;">
                    📍 ${post.city || post.country || 'Unknown'}<br>
                    🕒 ${formatTimeAgo(post.timestamp)}
                    ${post.userProfile ? `<br>👤 ${post.userProfile.ageGroup || 'Unknown'} • ${countryFlags[post.userProfile.country] || '🌍'} ${post.userProfile.country || 'Unknown'}` : ''}
                </div>
            </div>
        `)
        .addTo(markersLayer);

    marker.postData = post;
}

function updateRealtimeFeed() {
    const feedList = document.getElementById('feedList');
    let postsToShow = currentFilter ? 
        allPosts.filter(post => post.emotion === currentFilter) : 
        allPosts;
    
    if (postsToShow.length === 0) {
        feedList.innerHTML = `
            <div class="loading">
                <div>${translations[currentLang].loading_posts || "投稿を読み込み中..."}</div>
            </div>
        `;
        return;
    }

    const emotionEmojis = {
        happy: '😊', love: '❤️', excited: '🎉', grateful: '🙏'
    };

    const recentPosts = postsToShow.slice(0, 15);
    
    feedList.innerHTML = recentPosts.map(post => `
        <div class="post-item" data-post-id="${post.id}">
            <div class="post-emotion">${emotionEmojis[post.emotion]}</div>
            <div class="post-content">
                <div class="post-message">
                    ${post.message || translations[currentLang]['emotion_' + post.emotion] || post.emotion}
                </div>
                <div class="post-meta">
                    <div class="post-location">
                        <span>📍</span>
                        <span>${post.city || post.country || 'Unknown'}</span>
                    </div>
                    <div>🕒 ${formatTimeAgo(post.timestamp)}</div>
                    ${post.userProfile ? `<div>👤 ${post.userProfile.ageGroup || 'Unknown'}</div>` : ''}
                    ${post.userProfile && post.userProfile.country ? `<div class="country-flag">${countryFlags[post.userProfile.country] || '🌍'}</div>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

function updateFilteredFeed() {
    updateRealtimeFeed(); // フィルター状態に応じてフィードを更新
}

function addNewPostToFeed(post) {
    // フィルター適用時は該当する感情のみ表示
    if (currentFilter && post.emotion !== currentFilter) {
        return;
    }
    
    const feedList = document.getElementById('feedList');
    const emotionEmojis = { happy: '😊', love: '❤️', excited: '🎉', grateful: '🙏' };
    
    const newPostHtml = `
        <div class="post-item new-post" data-post-id="${post.id}">
            <div class="post-emotion">${emotionEmojis[post.emotion]}</div>
            <div class="post-content">
                <div class="post-message">
                    ${post.message || translations[currentLang]['emotion_' + post.emotion] || post.emotion}
                </div>
                <div class="post-meta">
                    <div class="post-location">
                        <span>📍</span>
                        <span>${post.city || post.country || 'Unknown'}</span>
                    </div>
                    <div>🕒 ${formatTimeAgo(post.timestamp)}</div>
                    ${post.userProfile ? `<div>👤 ${post.userProfile.ageGroup || 'Unknown'}</div>` : ''}
                    ${post.userProfile && post.userProfile.country ? `<div class="country-flag">${countryFlags[post.userProfile.country] || '🌍'}</div>` : ''}
                </div>
            </div>
        </div>
    `;
    
    feedList.insertAdjacentHTML('afterbegin', newPostHtml);
    
    const items = feedList.querySelectorAll('.post-item');
    if (items.length > 15) {
        items[items.length - 1].remove();
    }
}

function updateStatistics() {
    const counts = { happy: 0, love: 0, excited: 0, grateful: 0 };
    
    allPosts.forEach(post => {
        if (counts.hasOwnProperty(post.emotion)) {
            counts[post.emotion]++;
        }
    });

    document.getElementById('happyCount').textContent = counts.happy;
    document.getElementById('loveCount').textContent = counts.love;
    document.getElementById('excitedCount').textContent = counts.excited;
    document.getElementById('gratefulCount').textContent = counts.grateful;
    
    document.getElementById('totalPosts').textContent = allPosts.length.toLocaleString();
}

function showUpdateIndicator(emotion) {
    const card = document.querySelector(`[data-emotion="${emotion}"]`);
    if (card) {
        const indicator = document.createElement('div');
        indicator.className = 'update-indicator';
        card.appendChild(indicator);
        
        setTimeout(() => {
            if (indicator && indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
        }, 2000);
    }
}

function updateDataAnalytics() {
    // 市町村ランキング
    const cityStats = {};
    allPosts.forEach(post => {
        if (post.city && post.city !== 'Unknown') {
            const key = `${post.city}, ${post.country}`;
            cityStats[key] = (cityStats[key] || 0) + 1;
        }
    });

    const cityRanking = document.getElementById('cityRanking');
    const sortedCities = Object.entries(cityStats).sort(([,a], [,b]) => b - a).slice(0, 10);
    
    cityRanking.innerHTML = sortedCities.length > 0 ? sortedCities.map(([city, count], index) => {
        const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
        return `
            <div class="ranking-item">
                <div class="ranking-number ${rankClass}">${index + 1}</div>
                <div class="ranking-info">
                    <div class="ranking-city">${city}</div>
                    <div class="ranking-details">${count}件のポジティブ投稿</div>
                </div>
                <div class="ranking-count">${count}</div>
            </div>
        `;
    }).join('') : '<div class="loading"><div>データがありません</div></div>';

    // 国別統計
    const countryStats = {};
    const uniqueCountries = new Set();
    
    allPosts.forEach(post => {
        if (post.country) {
            uniqueCountries.add(post.country);
            countryStats[post.country] = (countryStats[post.country] || 0) + 1;
        }
    });

    document.getElementById('countriesCount').textContent = uniqueCountries.size;
    
    // 年齢層別分析
    const ageStats = {};
    allPosts.forEach(post => {
        if (post.userProfile && post.userProfile.ageGroup) {
            const age = post.userProfile.ageGroup;
            ageStats[age] = (ageStats[age] || 0) + 1;
        }
    });

    const ageAnalysis = document.getElementById('ageAnalysis');
    const sortedAges = Object.entries(ageStats).sort(([,a], [,b]) => b - a);
    
    ageAnalysis.innerHTML = sortedAges.length > 0 ? sortedAges.map(([age, count]) => `
        <div class="stat-item">
            <span class="stat-item-label">${age}</span>
            <span class="stat-item-value">${count}件</span>
        </div>
    `).join('') : '<div class="loading"><div>データがありません</div></div>';

    // 国別分析
    const countryAnalysis = document.getElementById('countryAnalysis');
    const sortedCountries = Object.entries(countryStats).sort(([,a], [,b]) => b - a).slice(0, 10);
        
    countryAnalysis.innerHTML = sortedCountries.length > 0 ? sortedCountries.map(([country, count]) => `
        <div class="stat-item">
            <span class="stat-item-label">${countryFlags[country] || '🌍'} ${country}</span>
            <span class="stat-item-value">${count}件</span>
        </div>
    `).join('') : '<div class="loading"><div>データがありません</div></div>';

    // 時間別統計
    const hourlyStats = new Array(24).fill(0);
    allPosts.forEach(post => {
        const hour = new Date(post.timestamp).getHours();
        hourlyStats[hour]++;
    });

    const maxHourly = Math.max(...hourlyStats, 1);
    const hourlyChart = document.getElementById('hourlyChart');
    
    hourlyChart.innerHTML = hourlyStats.map((count, hour) => {
        const height = (count / maxHourly) * 100;
        return `
            <div class="chart-bar" style="height: ${height}%">
                <div class="chart-label">${hour}</div>
            </div>
        `;
    }).join('');

    // 総ユーザー数（推定）
    const uniqueProfiles = new Set();
    allPosts.forEach(post => {
        if (post.userProfile) {
            uniqueProfiles.add(`${post.userProfile.ageGroup}-${post.userProfile.country}`);
        }
    });
    document.getElementById('totalUsers').textContent = uniqueProfiles.size || '---';
}

async function updateGlobalStatistics(post) {
    if (!isFirebaseConnected) return;
    
    try {
        const statsRef = db.collection('statistics').doc('global');
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(statsRef);
            
            if (!doc.exists) {
                transaction.set(statsRef, {
                    totalPosts: 1,
                    emotions: { [post.emotion]: 1 },
                    countries: { [post.country]: 1 },
                    cities: post.city ? { [post.city]: 1 } : {},
                    ageGroups: post.userProfile ? { [post.userProfile.ageGroup]: 1 } : {},
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                const data = doc.data();
                const updateData = {
                    totalPosts: (data.totalPosts || 0) + 1,
                    [`emotions.${post.emotion}`]: ((data.emotions && data.emotions[post.emotion]) || 0) + 1,
                    [`countries.${post.country}`]: ((data.countries && data.countries[post.country]) || 0) + 1,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                if (post.city) {
                    updateData[`cities.${post.city}`] = ((data.cities && data.cities[post.city]) || 0) + 1;
                }
                
                if (post.userProfile && post.userProfile.ageGroup) {
                    updateData[`ageGroups.${post.userProfile.ageGroup}`] = ((data.ageGroups && data.ageGroups[post.userProfile.ageGroup]) || 0) + 1;
                }
                
                transaction.update(statsRef, updateData);
            }
        });
    } catch (error) {
        console.error('統計更新エラー:', error);
    }
}

function savePostLocally(post) {
    const posts = JSON.parse(localStorage.getItem('positive_map_posts') || '[]');
    posts.unshift(post);
    if (posts.length > 200) {
        posts.splice(200);
    }
    localStorage.setItem('positive_map_posts', JSON.stringify(posts));
    allPosts = posts;
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const navMapping = { 'homeScreen': 0, 'postScreen': 1, 'profileScreen': 2, 'dataScreen': 3 };
    const navButtons = document.querySelectorAll('.nav-btn');
    if (navButtons[navMapping[screenId]]) {
        navButtons[navMapping[screenId]].classList.add('active');
    }

    const floatingBtn = document.getElementById('floatingPostBtn');
    floatingBtn.style.display = screenId === 'postScreen' ? 'none' : 'block';
    
    if (screenId === 'dataScreen') {
        updateDataAnalytics();
    } else if (screenId === 'profileScreen') {
        updateUserStats();
    }
}

function resetPostForm() {
    selectedEmotion = null;
    document.querySelectorAll('.emotion-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    document.getElementById('postMessage').value = '';
    document.getElementById('messageCount').textContent = '0';
    checkFormValidity();
}

function filterByEmotion(emotion) {
    currentFilter = emotion;
    markersLayer.clearLayers();
    
    const filteredPosts = allPosts.filter(post => post.emotion === emotion);
    filteredPosts.forEach(post => {
        addPostToMap(post);
    });

    // フィードも絞り込み
    updateRealtimeFeed();

    if (filteredPosts.length > 0) {
        const bounds = L.latLngBounds(filteredPosts.map(post => [post.location.lat, post.location.lng]));
        map.fitBounds(bounds, { padding: [20, 20] });
    }
    
    // カードのハイライト
    document.querySelectorAll('.stat-card').forEach(card => {
        card.classList.remove('active');
    });
    document.querySelector(`[data-emotion="${emotion}"]`).classList.add('active');
}

function showAllPosts() {
    currentFilter = null;
    markersLayer.clearLayers();
    allPosts.forEach(post => {
        addPostToMap(post);
    });
    
    // フィードもすべて表示
    updateRealtimeFeed();
    
    // カードのハイライト解除
    document.querySelectorAll('.stat-card').forEach(card => {
        card.classList.remove('active');
    });
    
    if (allPosts.length > 0) {
        const bounds = L.latLngBounds(allPosts.map(post => [post.location.lat, post.location.lng]));
        map.fitBounds(bounds, { padding: [20, 20] });
    }
}

function centerOnUser() {
    if (userLocation) {
        map.setView([userLocation.lat, userLocation.lng], 15);
    }
}

function toggleRealtime() {
    const toggleBtn = document.getElementById('realtimeToggle');
    isRealtimeEnabled = !isRealtimeEnabled;
    
    if (isRealtimeEnabled) {
        toggleBtn.textContent = '🔴 LIVE';
        toggleBtn.style.background = '#ef4444';
        if (isFirebaseConnected) {
            setupRealtimeListeners();
        }
    } else {
        toggleBtn.textContent = '⏸️ 停止';
        toggleBtn.style.background = '#6b7280';
        if (realtimeListener) {
            realtimeListener();
            realtimeListener = null;
        }
    }
}

function setupOnlineOfflineListeners() {
    const offlineBanner = document.getElementById('offlineBanner');
    
    window.addEventListener('online', () => {
        offlineBanner.style.display = 'none';
        if (isFirebaseConnected && isRealtimeEnabled) {
            setupRealtimeListeners();
        }
    });
    
    window.addEventListener('offline', () => {
        offlineBanner.style.display = 'block';
        if (realtimeListener) {
            realtimeListener();
            realtimeListener = null;
        }
    });
}

function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('positive_map_language', lang);
    
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.dataset.translate;
        if (translations[lang] && translations[lang][key]) {
            element.textContent = translations[lang][key];
        }
    });

    document.querySelectorAll('[data-translate-placeholder]').forEach(element => {
        const key = element.dataset.translatePlaceholder;
        if (translations[lang] && translations[lang][key]) {
            element.placeholder = translations[lang][key];
        }
    });

    // 国選択肢の更新
    updateCountryOptions(lang);

    markersLayer.clearLayers();
    allPosts.forEach(post => {
        addPostToMap(post);
    });
    
    updateRealtimeFeed();
    updateDataAnalytics();
}

function updateCountryOptions(lang) {
    const countrySelects = ['userCountry', 'modalUserCountry'];
    
    countrySelects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            const options = select.querySelectorAll('option[data-en]');
            options.forEach(option => {
                if (lang === 'en' && option.dataset.en) {
                    const flag = option.textContent.split(' ')[0];
                    option.textContent = `${flag} ${option.dataset.en}`;
                } else {
                    // 日本語に戻す場合は元のテキストを復元
                    const flag = option.textContent.split(' ')[0];
                    const value = option.value;
                    const japaneseNames = {
                        'Japan': '日本',
                        'United States': 'アメリカ',
                        'United Kingdom': 'イギリス',
                        'France': 'フランス',
                        'Germany': 'ドイツ',
                        'China': '中国',
                        'South Korea': '韓国',
                        'Spain': 'スペイン',
                        'Italy': 'イタリア',
                        'Australia': 'オーストラリア',
                        'Canada': 'カナダ',
                        'Brazil': 'ブラジル',
                        'India': 'インド',
                        'Other': 'その他'
                    };
                    option.textContent = `${flag} ${japaneseNames[value] || value}`;
                }
            });
        }
    });
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) {
        return translations[currentLang].just_now || "たった今";
    } else if (minutes < 60) {
        return `${minutes}${translations[currentLang].minutes_ago || "分前"}`;
    } else if (hours < 24) {
        return `${hours}${translations[currentLang].hours_ago || "時間前"}`;
    } else {
        return `${days}${translations[currentLang].days_ago || "日前"}`;
    }
}

function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    const mainContent = document.querySelector('.screen.active .main-content');
    mainContent.insertBefore(alertDiv, mainContent.firstChild);
    
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, 4000);
}

// PWA設定
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(registration => console.log('SW registered'))
        .catch(error => console.log('SW registration failed'));
}

const manifestData = {
    "name": "Positive Map - ポジティブ感情共有アプリ",
    "short_name": "Positive Map",
    "description": "世界中のポジティブな瞬間をリアルタイム共有",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#ffffff",
    "theme_color": "#6366f1",
    "orientation": "portrait",
    "icons": [
        {
            "src": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'><rect fill='%236366f1' width='192' height='192' rx='20'/><text x='96' y='120' font-size='80' text-anchor='middle' fill='white'>😊</text></svg>",
            "sizes": "192x192",
            "type": "image/svg+xml"
        },
        {
            "src": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><rect fill='%236366f1' width='512' height='512' rx='50'/><text x='256' y='320' font-size='200' text-anchor='middle' fill='white'>😊</text></svg>",
            "sizes": "512x512",
            "type": "image/svg+xml"
        }
    ]
};

const manifestBlob = new Blob([JSON.stringify(manifestData)], {
    type: 'application/json'
});
const manifestURL = URL.createObjectURL(manifestBlob);

const link = document.createElement('link');
link.rel = 'manifest';
link.href = manifestURL;
document.head.appendChild(link);// Firebase設定（変更しない）
const firebaseConfig = {
    apiKey: "AIzaSyA_WayicN-0FAkigK9tUPQiW5LCS0uBIJY",
    authDomain: "positive-map-2ff93.firebaseapp.com",
    projectId: "positive-map-2ff93",
    storageBucket: "positive-map-2ff93.firebasestorage.app",
    messagingSenderId: "393573253626",
    appId: "1:393573253626:web:4c9c127652042403756443"
};

// Firebase初期化
let app, db, auth;
let isFirebaseConnected = false;

try {
    app = firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    
    db.settings({
        cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
    });
    
    db.enablePersistence().catch((err) => {
        if (err.code == 'failed-precondition') {
            console.log('複数のタブが開いています');
        } else if (err.code == 'unimplemented') {
            console.log('ブラウザがオフライン永続化をサポートしていません');
        }
    });
    
    isFirebaseConnected = true;
    console.log('Firebase接続成功');
} catch (error) {
    console.warn('Firebase接続失敗、ローカルモードで動作:', error);
    isFirebaseConnected = false;
}

// グローバル変数
let map, locationPickerMap;
let userLocation = null;
let selectedLocation = null;
let selectedEmotion = null;
let currentLang = 'ja';
let allPosts = [];
let filteredPosts = [];
let currentFilter = null;
let markersLayer;
let realtimeListener = null;
let isRealtimeEnabled = true;
let userProfile = {};
let locationPickerCircle = null;

// 不適切な内容を検出するキーワードリスト
const inappropriateKeywords = [
    // 日本語
    '死ね', 'バカ', 'アホ', 'クソ', 'うんち', 'うんこ', 'ばか', 'あほ', 'くそ', 'きらい', '嫌い', 'むかつく', 'ウザい', 'うざい',
    'ブス', 'ぶす', 'デブ', 'でぶ', '殺す', 'ころす', '暴力', 'いじめ', 'キモい', 'きもい', '消えろ', '氏ね',
    // 英語
    'stupid', 'idiot', 'hate', 'kill', 'die', 'ugly', 'fat', 'dumb', 'shut up', 'loser', 'freak', 'weird',
    'gross', 'disgusting', 'violence', 'bully', 'bullying', 'annoying'
];

// 多言語翻訳データ
const translations = {
    ja: {
        app_title: "Positive Map",
        app_subtitle: "世界中のポジティブな瞬間をリアルタイム共有",
        emotion_happy: "嬉しい",
        emotion_love: "愛",
        emotion_excited: "興奮",
        emotion_grateful: "感謝",
        post_title: "今の気持ちを世界に投稿",
        select_emotion: "感情を選択してください",
        optional_message: "メッセージ（任意）",
        message_placeholder: "今の気持ちを詳しく...",
        getting_location: "📍 位置情報を取得中...",
        location_found: "📍 位置情報取得完了",
        location_error: "📍 位置情報の取得に失敗しました",
        select_location: "位置を選択",
        use_current: "現在地を使用",
        post_button: "世界に投稿する",
        center_map: "現在地",
        show_all: "全て表示",
        nav_map: "マップ",
        nav_post: "投稿",
        nav_profile: "プロフィール",
        nav_data: "データ",
        post_success: "投稿が世界に共有されました！",
        post_error: "投稿に失敗しました",
        users_online: "🌟 みんなのポジティブ経験を共有中",
        live_feed: "リアルタイム投稿",
        loading_posts: "投稿を読み込み中...",
        data_analytics: "データ分析",
        total_users: "総ユーザー数",
        countries_represented: "参加国数",
        age_analysis: "年齢層別分析",
        country_analysis: "国別分析",
        hourly_analysis: "時間別分析",
        city_ranking: "ポジティブな市町村ランキング",
        analyzing_data: "データを分析中...",
        loading_countries: "国別データを読み込み中...",
        profile_title: "プロフィール",
        posts: "投稿",
        days: "日間",
        countries: "国",
        user_settings: "ユーザー設定",
        age_group: "年齢層",
        country: "居住国",
        select_age: "選択してください",
        select_country: "選択してください",
        post_history: "投稿履歴",
        no_posts: "まだ投稿がありません",
        just_now: "たった今",
        minutes_ago: "分前",
        hours_ago: "時間前",
        days_ago: "日前",
        connected: "接続済み",
        connecting: "接続中...",
        offline: "オフライン",
        profile_saved: "プロフィールを保存しました",
        profile_required: "投稿前にプロフィールを設定してください",
        inappropriate_content: "不適切な内容が検出されたため、メッセージを削除して投稿します"
    },
    en: {
        app_title: "Positive Map",
        app_subtitle: "Share positive moments worldwide in real-time",
        emotion_happy: "Happy",
        emotion_love: "Love",
        emotion_excited: "Excited",
        emotion_grateful: "Grateful",
        post_title: "Share Your Feeling to the World",
        select_emotion: "Select your emotion",
        optional_message: "Message (Optional)",
        message_placeholder: "Tell us how you're feeling...",
        getting_location: "📍 Getting your location...",
        location_found: "📍 Location found",
        location_error: "📍 Failed to get location",
        select_location: "Select Location",
        use_current: "Use Current",
        post_button: "Share to World",
        center_map: "My Location",
        show_all: "Show All",
        nav_map: "Map",
        nav_post: "Post",
        nav_profile: "Profile",
        nav_data: "Data",
        post_success: "Your happiness has been shared worldwide!",
        post_error: "Failed to submit post",
        users_online: "🌟 Sharing positive experiences together",
        live_feed: "Live Feed",
        loading_posts: "Loading posts...",
        data_analytics: "Data Analytics",
        total_users: "Total Users",
        countries_represented: "Countries",
        age_analysis: "Age Group Analysis",
        country_analysis: "Country Analysis",
        hourly_analysis: "Hourly Analysis",
        city_ranking: "Top Positive Cities Ranking",
        analyzing_data: "Analyzing data...",
        loading_countries: "Loading country data...",
        profile_title: "Profile",
        posts: "Posts",
        days: "Days",
        countries: "Countries",
        user_settings: "User Settings",
        age_group: "Age Group",
        country: "Country",
        select_age: "Select age",
        select_country: "Select country",
        post_history: "Post History",
        no_posts: "No posts yet",
        just_now: "Just now",
        minutes_ago: "min ago",
        hours_ago: "hr ago",
        days_ago: "days ago",
        connected: "Connected",
        connecting: "Connecting...",
        offline: "Offline",
        profile_saved: "Profile saved successfully",
        profile_required: "Please set up your profile before posting",
        inappropriate_content: "Inappropriate content detected. Posted without message."
    }
};

// 国旗マッピング
const countryFlags = {
    'Japan': '🇯🇵',
    'United States': '🇺🇸',
    'United Kingdom': '🇬🇧',
    'France': '🇫🇷',
    'Germany': '🇩🇪',
    'China': '🇨🇳',
    'South Korea': '🇰🇷',
    'Spain': '🇪🇸',
    'Italy': '🇮🇹',
    'Australia': '🇦🇺',
    'Canada': '🇨🇦',
    'Brazil': '🇧🇷',
    'India': '🇮🇳',
    'Other': '🌍'
};

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    initializeMap();
    getUserLocation();
    setupEventListeners();
    monitorConnection();
    loadUserProfile();
    
    if (isFirebaseConnected) {
        setupRealtimeListeners();
        loadFirebaseData();
    } else {
        loadLocalData();
    }
    
    updateStatistics();
    changeLanguage(currentLang);
    setupOnlineOfflineListeners();
}

// 不適切な内容検出
function hasInappropriateContent(text) {
    if (!text) return false;
    
    const lowerText = text.toLowerCase();
    return inappropriateKeywords.some(keyword => 
        lowerText.includes(keyword.toLowerCase())
    );
}

// ユーザープロフィール読み込み
function loadUserProfile() {
    const saved = localStorage.getItem('positive_map_profile');
    if (saved) {
        userProfile = JSON.parse(saved);
        document.getElementById('ageGroup').value = userProfile.ageGroup || '';
        document.getElementById('userCountry').value = userProfile.country || '';
    }
}

// プロフィール保存
function saveProfile() {
    userProfile.ageGroup = document.getElementById('ageGroup').value;
    userProfile.country = document.getElementById('userCountry').value;
    userProfile.lastUpdated = Date.now();
    
    localStorage.setItem('positive_map_profile', JSON.stringify(userProfile));
    showAlert(translations[currentLang].profile_saved || "プロフィールを保存しました", 'success');
    updateUserStats();
}

// モーダルプロフィール保存
function saveModalProfile() {
    const ageGroup = document.getElementById('modalAgeGroup').value;
    const country = document.getElementById('modalUserCountry').value;
    
    if (!ageGroup || !country) {
        showAlert('年齢層と居住国を選択してください', 'error');
        return;
    }
    
    userProfile.ageGroup = ageGroup;
    userProfile.country = country;
    userProfile.lastUpdated = Date.now();
    
    localStorage.setItem('positive_map_profile', JSON.stringify(userProfile));
    
    // メイン画面のプロフィールも更新
    document.getElementById('ageGroup').value = ageGroup;
    document.getElementById('userCountry').value = country;
    
    closeProfileModal();
    showAlert(translations[currentLang].profile_saved || "プロフィールを保存しました", 'success');
}

// プロフィールモーダル表示
function showProfileModal() {
    const modal = document.getElementById('profileModal');
    modal.classList.add('active');
}

// プロフィールモーダル閉じる
function closeProfileModal() {
    const modal = document.getElementById('profileModal');
    modal.classList.remove('active');
}

// プロフィールチェック
function checkProfileComplete() {
    return userProfile.ageGroup && userProfile.country;
}

// ユーザー統計更新
function updateUserStats() {
    const userPosts = allPosts.filter(post => 
        post.userProfile && 
        post.userProfile.ageGroup === userProfile.ageGroup &&
        post.userProfile.country === userProfile.country
    );
    
    document.getElementById('userPostCount').textContent = userPosts.length;
    
    if (userPosts.length > 0) {
        const firstPost = Math.min(...userPosts.map(p => p.timestamp));
        const daysSince = Math.floor((Date.now() - firstPost) / (1000 * 60 * 60 * 24));
        document.getElementById('userDays').textContent = Math.max(1, daysSince);
    }
    
    updatePostHistory();
}

// 投稿履歴更新
function updatePostHistory() {
    const historyList = document.getElementById('historyList');
    const userPosts = allPosts.filter(post => 
        post.userProfile && 
        post.userProfile.ageGroup === userProfile.ageGroup &&
        post.userProfile.country === userProfile.country
    ).sort((a, b) => b.timestamp - a.timestamp);
    
    if (userPosts.length === 0) {
        historyList.innerHTML = `
            <div class="loading">
                <div data-translate="no_posts">${translations[currentLang].no_posts || "まだ投稿がありません"}</div>
            </div>
        `;
        return;
    }

    const emotionEmojis = {
        happy: '😊', love: '❤️', excited: '🎉', grateful: '🙏'
    };

    historyList.innerHTML = userPosts.slice(0, 10).map(post => `
        <div class="stat-item">
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 20px;">${emotionEmojis[post.emotion]}</span>
                <div>
                    <div class="stat-item-label">
                        ${post.message || translations[currentLang]['emotion_' + post.emotion] || post.emotion}
                    </div>
                    <div style="font-size: 11px; color: var(--text-light);">
                        📍 ${post.city || post.country || 'Unknown'} • ${formatTimeAgo(post.timestamp)}
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// 位置選択モーダル
function openLocationPicker() {
    const modal = document.getElementById('locationModal');
    modal.classList.add('active');
    
    setTimeout(() => {
        if (!locationPickerMap) {
            initLocationPickerMap();
        } else {
            locationPickerMap.invalidateSize();
        }
    }, 100);
}

function closeLocationModal() {
    document.getElementById('locationModal').classList.remove('active');
}

function initLocationPickerMap() {
    const defaultLocation = userLocation || [35.6762, 139.6503];
    
    locationPickerMap = L.map('locationPickerMap').setView(defaultLocation, 15);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(locationPickerMap);

    let marker = null;
    selectedLocation = userLocation;

    // 現在地から半径100mの円を表示
    if (userLocation) {
        locationPickerCircle = L.circle(userLocation, {
            color: '#6366f1',
            fillColor: '#6366f1',
            fillOpacity: 0.1,
            radius: 100
        }).addTo(locationPickerMap);
        
        marker = L.marker(userLocation).addTo(locationPickerMap);
    }

    locationPickerMap.on('click', function(e) {
        const clickedLocation = { lat: e.latlng.lat, lng: e.latlng.lng };
        
        // 現在地から100m以内かチェック
        if (userLocation) {
            const distance = calculateDistance(userLocation, clickedLocation);
            if (distance > 100) {
                showAlert('現在地から100m以内で選択してください', 'warning');
                return;
            }
        }
        
        selectedLocation = clickedLocation;

        if (marker) {
            locationPickerMap.removeLayer(marker);
        }
        
        marker = L.marker([selectedLocation.lat, selectedLocation.lng]).addTo(locationPickerMap);
    });
}

// 距離計算（メートル）
function calculateDistance(pos1, pos2) {
    const R = 6371e3; // 地球の半径（メートル）
    const φ1 = pos1.lat * Math.PI/180;
    const φ2 = pos2.lat * Math.PI/180;
    const Δφ = (pos2.lat-pos1.lat) * Math.PI/180;
    const Δλ = (pos2.lng-pos1.lng) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

function useCurrentLocation() {
    if (userLocation) {
        selectedLocation = userLocation;
        closeLocationModal();
        updateLocationDisplay();
    } else {
        getUserLocationManual();
    }
}

function confirmLocation() {
    if (selectedLocation) {
        closeLocationModal();
        updateLocationDisplay();
        checkFormValidity();
    }
}

function updateLocationDisplay() {
    const locationInfo = document.getElementById('locationInfo');
    const coordinates = document.getElementById('coordinates');
    
    if (selectedLocation) {
        locationInfo.querySelector('.location-status').textContent = 
            translations[currentLang].location_found || "📍 位置情報取得完了";
        coordinates.textContent = 
            `${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}`;
    }
}

// データ更新ボタン
function refreshData() {
    const refreshBtn = document.querySelector('.refresh-btn');
    refreshBtn.style.transform = 'rotate(180deg)';
    
    if (isFirebaseConnected) {
        loadFirebaseData();
    } else {
        loadLocalData();
    }
    
    setTimeout(() => {
        refreshBtn.style.transform = 'rotate(0deg)';
        showAlert('データを更新しました', 'success');
    }, 1000);
}

// Firebase接続状態監視
function monitorConnection() {
    const connectionStatus = document.getElementById('connectionStatus');
    const connectionText = document.getElementById('connectionText');
    
    if (isFirebaseConnected) {
        window.addEventListener('online', () => {
            connectionStatus.classList.remove('offline');
            connectionStatus.classList.add('online');
            connectionText.textContent = translations[currentLang].connected || '接続済み';
            
            if (isRealtimeEnabled) {
                setupRealtimeListeners();
            }
        });
        
        window.addEventListener('offline', () => {
            connectionStatus.classList.remove('online');
            connectionStatus.classList.add('offline');
            connectionText.textContent = translations[currentLang].offline || 'オフライン';
        });
        
        if (navigator.onLine) {
            connectionStatus.classList.add('online');
            connectionText.textContent = translations[currentLang].connected || '接続済み';
        } else {
            connectionStatus.classList.add('offline');
            connectionText.textContent = translations[currentLang].offline || 'オフライン';
        }
    } else {
        connectionStatus.classList.add('offline');
        connectionText.textContent = 'ローカルモード';
    }
}

// リアルタイムリスナー設定
function setupRealtimeListeners() {
    if (!isFirebaseConnected) return;

    try {
        realtimeListener = db.collection('posts')
            .orderBy('timestamp', 'desc')
            .limit(50)
            .onSnapshot({
                includeMetadataChanges: true
            }, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const post = { 
                            id: change.doc.id, 
                            ...change.doc.data(),
                            timestamp: change.doc.data().timestamp?.toDate?.()?.getTime() || change.doc.data().clientTimestamp || Date.now()
                        };
                        
                        if (!allPosts.find(p => p.id === post.id)) {
                            allPosts.unshift(post);
                            addNewPostToFeed(post);
                            addPostToMap(post);
                            updateStatistics();
                            updateFilteredFeed();
                            showUpdateIndicator(post.emotion);
                        }
                    }
                });
            }, (error) => {
                console.error('リアルタイム監視エラー:', error);
                
                if (error.code === 'permission-denied') {
                    showAlert('データベースの権限設定を確認してください', 'error');
                    isFirebaseConnected = false;
                    loadLocalData();
                } else if (error.code === 'unavailable') {
                    showAlert('ネットワーク接続を確認してください', 'warning');
                } else {
                    showAlert('リアルタイム更新でエラーが発生しました', 'warning');
                }
            });
    } catch (error) {
        console.error('リスナー設定エラー:', error);
        showAlert('リアルタイム機能の初期化に失敗しました', 'error');
    }
}

// 地図初期化
function initializeMap() {
    const defaultLocation = [35.6762, 139.6503];
    
    map = L.map('map').setView(defaultLocation, 3);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);
}

// 位置情報取得
function getUserLocation() {
    const locationInfo = document.getElementById('locationInfo');
    const coordinates = document.getElementById('coordinates');

    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                selectedLocation = userLocation;

                locationInfo.querySelector('.location-status').textContent = 
                    translations[currentLang].location_found || "📍 位置情報取得完了";
                coordinates.textContent = 
                    `${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}`;

                map.setView([userLocation.lat, userLocation.lng], 13);
                checkFormValidity();
            },
            function(error) {
                locationInfo.querySelector('.location-status').textContent = 
                    translations[currentLang].location_error || "📍 位置情報の取得に失敗しました";
                coordinates.textContent = "位置を手動で選択してください";
                
                userLocation = { lat: 35.6762, lng: 139.6503 };
                selectedLocation = userLocation;
                checkFormValidity();
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000
            }
        );
    } else {
        userLocation = { lat: 35.6762, lng: 139.6503 };
        selectedLocation = userLocation;
        checkFormValidity();
    }
}

function getUserLocationManual() {
    getUserLocation();
}

// イベントリスナー設定
function setupEventListeners() {
    document.querySelectorAll('.emotion-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.emotion-btn').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            selectedEmotion = this.dataset.emotion;
            checkFormValidity();
        });
    });

    document.getElementById('langSelector').addEventListener('change', function() {
        changeLanguage(this.value);
    });

    document.getElementById('postMessage').addEventListener('input', function() {
        document.getElementById('messageCount').textContent = this.value.length;
    });
}

function checkFormValidity() {
    const submitBtn = document.getElementById('submitPostBtn');
    const isValid = selectedEmotion && selectedLocation;
    
    submitBtn.disabled = !isValid;
    if (isValid) {
        submitBtn.textContent = translations[currentLang].post_button || "世界に投稿する";
    }
}

// 投稿送信
async function submitPost() {
    if (!selectedEmotion || !selectedLocation) {
        showAlert(translations[currentLang].post_error || "投稿に失敗しました", 'error');
        return;
    }

    // プロフィールチェック
    if (!checkProfileComplete()) {
        showAlert(translations[currentLang].profile_required || "投稿前にプロフィールを設定してください", 'warning');
        showProfileModal();
        return;
    }

    const submitBtn = document.getElementById('submitPostBtn');
    submitBtn.classList.add('btn-loading');
    submitBtn.disabled = true;
    submitBtn.textContent = "投稿中...";

    try {
        let message = document.getElementById('postMessage').value.trim();
        let isInappropriate = false;
        
        // 不適切な内容チェック
        if (hasInappropriateContent(message)) {
            message = ''; // メッセージを削除
            isInappropriate = true;
        }
        
        const now = new Date();
        const locationData = await getLocationDetails(selectedLocation.lat, selectedLocation.lng);

        const post = {
            emotion: selectedEmotion,
            message: message,
            location: {
                lat: selectedLocation.lat,
                lng: selectedLocation.lng
            },
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            country: locationData.country,
            city: locationData.city,
            language: currentLang,
            clientTimestamp: now.getTime(),
            userProfile: {
                ageGroup: userProfile.ageGroup,
                country: userProfile.country
            }
        };

        if (isFirebaseConnected) {
            try {
                const docRef = await db.collection('posts').add(post);
                console.log('投稿成功:', docRef.id);
                
                await updateGlobalStatistics({
                    ...post,
                    id: docRef.id,
                    timestamp: now.getTime()
                });
                
            } catch (firestoreError) {
                console.error('Firestore保存エラー:', firestoreError);
                
                if (firestoreError.code === 'permission-denied') {
                    throw new Error('データベースの権限設定に問題があります');
                } else {
                    throw firestoreError;
                }
            }
        } else {
            const localPost = {
                ...post,
                id: generateId(),
                timestamp: now.getTime(),
                country: locationData.country,
                city: locationData.city
            };
            savePostLocally(localPost);
            addPostToMap(localPost);
            addNewPostToFeed(localPost);
            updateStatistics();
            updateFilteredFeed();
        }

        if (isInappropriate) {
            showAlert(translations[currentLang].inappropriate_content || "不適切な内容が検出されたため、メッセージを削除して投稿します", 'warning');
        } else {
            showAlert(translations[currentLang].post_success || "投稿が世界に共有されました！", 'success');
        }
        
        resetPostForm();
        
        setTimeout(() => {
            showScreen('homeScreen');
        }, 2000);

    } catch (error) {
        console.error('投稿エラー:', error);
        showAlert(error.message || translations[currentLang].post_error || "投稿に失敗しました", 'error');
    } finally {
        submitBtn.classList.remove('btn-loading');
        submitBtn.disabled = false;
        checkFormValidity();
    }
}