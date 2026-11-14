const searchInput = document.getElementById('searchInput');
const videoGrid = document.getElementById('videoGrid');
const emptyState = document.getElementById('emptyState');
const uploadDialog = document.getElementById('uploadDialog');
const uploadForm = document.getElementById('uploadForm');
const uploadNotice = document.getElementById('uploadNotice');
const uploadSubmit = document.getElementById('uploadSubmit');
const accountDialog = document.getElementById('accountDialog');
const accountForm = document.getElementById('accountForm');
const accountButton = document.getElementById('accountButton');
const authNotice = document.getElementById('authNotice');
const authSubmit = document.getElementById('authSubmit');
const signOutButton = document.getElementById('signOutButton');
const displayNameField = document.getElementById('displayNameField');
const confirmPasswordField = document.getElementById('confirmPasswordField');
const forgotPasswordButton = document.getElementById('forgotPassword');
const referralLink = document.getElementById('referralLink');
const copyReferral = document.getElementById('copyReferral');
let authMode = 'signin';
let supabaseClient = null;
let currentUser = null;
let allVideos = [];
let activeCategory = 'All';

const incomingReferral = new URLSearchParams(location.search).get('ref');
if (incomingReferral && /^[A-Z0-9]{4,20}$/i.test(incomingReferral)) {
  localStorage.setItem('videarn_referral_code', incomingReferral.toUpperCase());
}
function showAuthNotice(message, isError = false) {
  authNotice.textContent = message;
  authNotice.style.color = isError ? '#ff9caa' : '#9ee5c0';
}
function setAuthMode(mode) {
  authMode = mode;
  const creating = mode === 'signup';
  const recovering = mode === 'recovery';
  confirmPasswordField.hidden = !(creating || recovering);
  document.getElementById('confirmPassword').required = creating || recovering;
  forgotPasswordButton.hidden = creating || recovering;
  document.getElementById('authPassword').autocomplete = recovering || creating ? 'new-password' : 'current-password';
  document.getElementById('accountTitle').textContent = recovering ? 'Choose a new password' : creating ? 'Create your account' : 'Welcome back';
  document.getElementById('accountMessage').textContent = recovering ? 'Enter and confirm your new password.' : creating ? 'Join VidEarn and get your own invite link.' : 'Sign in to manage your VidEarn account.';
  displayNameField.hidden = !creating;
  document.getElementById('displayName').required = creating;
  authSubmit.textContent = recovering ? 'Update password' : creating ? 'Create account' : 'Sign in';
  document.getElementById('switchAuth').hidden = recovering;
  document.getElementById('switchAuth').textContent = creating ? 'Already registered? Sign in' : 'New here? Create an account';
  showAuthNotice('');
}
document.getElementById('switchAuth').addEventListener('click', () => setAuthMode(authMode === 'signin' ? 'signup' : 'signin'));
document.querySelectorAll('[data-toggle-password]').forEach(button => button.addEventListener('click', () => {
  const input = document.getElementById(button.dataset.togglePassword);
  input.type = input.type === 'password' ? 'text' : 'password';
  button.textContent = input.type === 'password' ? 'Show' : 'Hide';
  button.setAttribute('aria-label', input.type === 'password' ? 'Show password' : 'Hide password');
}));
forgotPasswordButton.addEventListener('click', async () => {
  if (!supabaseClient) return showAuthNotice('Supabase connection is not available.', true);
  const email = document.getElementById('authEmail').value.trim();
  if (!email) return showAuthNotice('Pehle apna email address likhein.', true);
  forgotPasswordButton.disabled = true;
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  forgotPasswordButton.disabled = false;
  showAuthNotice(error ? error.message : 'Agar account maujood hai to reset link email kar diya gaya hai. Inbox aur Spam check karein.', !!error);
});
document.getElementById('closeAccount').addEventListener('click', () => accountDialog.close());
document.getElementById('closeUpload').addEventListener('click', () => uploadDialog.close());
accountButton.addEventListener('click', () => { setAuthMode('signin'); accountDialog.showModal(); });
signOutButton.addEventListener('click', async () => {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signOut();
  if (error) showAuthNotice(error.message, true);
  else showAuthNotice('You have signed out.');
});
accountForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!supabaseClient) return showAuthNotice('Supabase config load nahi hui.', true);
  authSubmit.disabled = true;
  showAuthNotice('Please wait...');
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  if ((authMode === 'signup' || authMode === 'recovery') && password !== confirmPassword) {
    authSubmit.disabled = false;
    return showAuthNotice('Dono passwords match nahi karte.', true);
  }
  let result;
  if (authMode === 'recovery') {
    result = await supabaseClient.auth.updateUser({ password });
    authSubmit.disabled = false;
    if (result.error) showAuthNotice(result.error.message, true);
    else { showAuthNotice('Password update ho gaya.'); setAuthMode('signin'); }
    return;
  }
  if (authMode === 'signup') {
    result = await supabaseClient.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: location.origin + location.pathname,
        data: {
          display_name: document.getElementById('displayName').value.trim(),
          referral_code: localStorage.getItem('videarn_referral_code') || ''
        }
      }
    });
  } else {
    result = await supabaseClient.auth.signInWithPassword({ email, password });
  }
  authSubmit.disabled = false;
  if (result.error) showAuthNotice(result.error.message, true);
  else if (result.data.session) {
    showAuthNotice('Account sign-in ho gaya.');
    await refreshAccount();
    await loadVideos();
  } else showAuthNotice('Account create ho gaya. Email confirm karke sign in karein.');
});
async function refreshAccount() {
  if (!supabaseClient) return;
  const { data: { user } } = await supabaseClient.auth.getUser();
  currentUser = user || null;
  if (!currentUser) {
    accountButton.textContent = 'U';
    referralLink.textContent = 'Sign in to get your link';
    copyReferral.disabled = true;
    document.getElementById('referralStatus').textContent = 'Sign in to receive your personal referral link.';
    signOutButton.hidden = true;
    return;
  }
  const { data: profile, error } = await supabaseClient.from('profiles')
    .select('display_name, referral_code').eq('id', currentUser.id).maybeSingle();
  accountButton.textContent = (profile?.display_name || currentUser.email?.split('@')[0] || 'U').slice(0,1).toUpperCase();
  signOutButton.hidden = false;
  if (error || !profile?.referral_code) {
    document.getElementById('referralStatus').textContent = 'Profile/referral database setup check karein.';
    return;
  }
  const link = new URL(location.href);
  link.search = ''; link.hash = '';
  link.searchParams.set('ref', profile.referral_code);
  referralLink.textContent = link.toString();
  copyReferral.disabled = false;
  document.getElementById('referralStatus').textContent = 'Your referral code: ' + profile.referral_code + '. Rewards are not active until terms and payout rules are launched.';
}
copyReferral.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(referralLink.textContent); document.getElementById('referralStatus').textContent = 'Referral link copied.'; }
  catch { document.getElementById('referralStatus').textContent = 'Link ko press karke copy karein.'; }
});
function filterVideos() {
  const term = searchInput.value.trim().toLowerCase();
  let visible = 0;
  [...videoGrid.children].forEach(card => {
    const text = (card.dataset.title + ' ' + card.dataset.description).toLowerCase();
    const matches = text.includes(term) && (activeCategory === 'All' || card.dataset.category === activeCategory);
    card.hidden = !matches;
    if (matches) visible++;
  });
  emptyState.hidden = visible !== 0;
}
searchInput.addEventListener('input', filterVideos);
document.querySelectorAll('.chip').forEach(chip => chip.addEventListener('click', () => {
  document.querySelector('.chip.selected')?.classList.remove('selected');
  chip.classList.add('selected');
  activeCategory = chip.dataset.category;
  filterVideos();
}));
function renderVideos(rows) {
  allVideos = rows || [];
  videoGrid.replaceChildren();
  allVideos.forEach(video => {
    const card = document.createElement('article');
    card.className = 'video-card';
    card.dataset.category = video.category || 'Entertainment';
    card.dataset.title = video.title || '';
    card.dataset.description = video.description || '';
    const thumb = document.createElement('a');
    thumb.className = 'thumb video-thumb';
    thumb.href = video.video_url || '#';
    thumb.target = '_blank';
    thumb.rel = 'noopener noreferrer';
    thumb.setAttribute('aria-label', 'Play ' + video.title);
    if (video.thumbnail_url) thumb.style.backgroundImage = 'linear-gradient(#0002,#0005),url("' + video.thumbnail_url.replace(/"/g,'%22') + '")';
    else thumb.style.background = 'linear-gradient(135deg,#25204e,#31546c)';
    const play = document.createElement('span'); play.className = 'play'; play.textContent = '▶'; thumb.append(play);
    const word = document.createElement('span'); word.className = 'thumb-word'; word.textContent = video.status === 'pending' ? 'UNDER\nREVIEW' : (video.category || 'VIDEO').toUpperCase(); thumb.append(word);
    if (video.status === 'pending') { const badge=document.createElement('span'); badge.className='duration'; badge.textContent='Pending review'; thumb.append(badge); }
    const info = document.createElement('div'); info.className = 'video-info';
    const avatar = document.createElement('div'); avatar.className = 'channel-pic purple'; avatar.textContent = (video.profiles?.display_name || 'C').slice(0,1).toUpperCase();
    const details = document.createElement('div'); const title = document.createElement('h3'); title.textContent = video.title;
    const meta = document.createElement('p'); meta.textContent = (video.profiles?.display_name || 'VidEarn creator') + ' · ' + new Date(video.created_at).toLocaleDateString();
    details.append(title,meta); info.append(avatar,details); card.append(thumb,info); videoGrid.append(card);
  });
  filterVideos();
  if (!allVideos.length) { emptyState.hidden = false; emptyState.textContent = 'Abhi koi published video nahi. Creator account se pehli video upload karein.'; }
  else emptyState.textContent = 'No videos match your search yet.';
}
async function loadVideos() {
  if (!supabaseClient) return;
  const { data, error } = await supabaseClient.from('videos')
    .select('id,title,description,video_url,thumbnail_url,category,status,created_at,owner_id,profiles(display_name)')
    .order('created_at', { ascending: false }).limit(60);
  if (error) { emptyState.hidden = false; emptyState.textContent = 'Videos load nahi ho sakin: ' + error.message; return; }
  renderVideos(data || []);
}
['uploadTop','uploadBanner'].forEach(id => document.getElementById(id).addEventListener('click', () => {
  if (!currentUser) { setAuthMode('signin'); accountDialog.showModal(); showAuthNotice('Upload ke liye pehle sign in karein.'); return; }
  uploadDialog.showModal();
}));
uploadForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!currentUser) { uploadNotice.textContent = 'Pehle sign in karein.'; return; }
  const file = document.getElementById('videoFile').files[0];
  const title = document.getElementById('videoTitle').value.trim();
  if (!file || !file.type.startsWith('video/')) { uploadNotice.textContent = 'Valid video file select karein.'; return; }
  if (file.size > 500 * 1024 * 1024) { uploadNotice.textContent = 'File 500 MB se bari hai.'; return; }
  uploadSubmit.disabled = true;
  uploadNotice.textContent = 'Video upload ho rahi hai. Isay band na karein...';
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
  const path = currentUser.id + '/' + crypto.randomUUID() + '-' + safeName;
  const { error: storageError } = await supabaseClient.storage.from('videos').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
  if (storageError) {
    uploadSubmit.disabled = false;
    uploadNotice.textContent = 'Storage error: ' + storageError.message + ' — SQL setup aur videos bucket check karein.';
    return;
  }
  const { data: publicData } = supabaseClient.storage.from('videos').getPublicUrl(path);
  const { error: rowError } = await supabaseClient.from('videos').insert({
    owner_id: currentUser.id, title, description: document.getElementById('videoDescription').value.trim(),
    category: document.getElementById('videoCategory').value, video_url: publicData.publicUrl,
    status: 'pending', visibility: 'private'
  });
  if (rowError) {
    await supabaseClient.storage.from('videos').remove([path]);
    uploadNotice.textContent = 'Database error: ' + rowError.message;
  } else {
    uploadNotice.textContent = 'Upload complete! Video moderation ke liye submit ho gayi hai.';
    uploadForm.reset();
    await loadVideos();
  }
  uploadSubmit.disabled = false;
});
(function initializeSupabase() {
  const config = window.VIDEARN_SUPABASE || {};
  if (!window.supabase || !config.url || !config.anonKey) {
    document.getElementById('referralStatus').textContent = 'Supabase configuration load nahi hui.';
    return;
  }
  supabaseClient = window.supabase.createClient(config.url, config.anonKey);
  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') { setAuthMode('recovery'); accountDialog.showModal(); }
    refreshAccount();
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') loadVideos();
  });
  refreshAccount();
  loadVideos();
})();