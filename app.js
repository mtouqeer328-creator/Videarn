const searchInput = document.getElementById('searchInput');
const cards = [...document.querySelectorAll('.video-card')];
const emptyState = document.getElementById('emptyState');
let activeCategory = 'All';

function filterVideos() {
  const term = searchInput.value.trim().toLowerCase();
  let visible = 0;
  cards.forEach(card => {
    const matchesText = card.dataset.title.toLowerCase().includes(term);
    const matchesCategory = activeCategory === 'All' || card.dataset.category === activeCategory;
    card.hidden = !(matchesText && matchesCategory);
    if (!card.hidden) visible++;
  });
  emptyState.hidden = visible !== 0;
}
searchInput.addEventListener('input', filterVideos);
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelector('.chip.selected')?.classList.remove('selected');
    chip.classList.add('selected');
    activeCategory = chip.dataset.category;
    filterVideos();
  });
});

const uploadDialog = document.getElementById('uploadDialog');
['uploadTop', 'uploadBanner'].forEach(id => {
  document.getElementById(id).addEventListener('click', () => uploadDialog.showModal());
});

const accountDialog = document.getElementById('accountDialog');
const accountForm = document.getElementById('accountForm');
const accountButton = document.getElementById('accountButton');
const authNotice = document.getElementById('authNotice');
const authSubmit = document.getElementById('authSubmit');
const signOutButton = document.getElementById('signOutButton');
const displayNameField = document.getElementById('displayNameField');
const referralLink = document.getElementById('referralLink');
const copyReferral = document.getElementById('copyReferral');
let authMode = 'signin';
let supabaseClient = null;
let currentUser = null;

// Keep an incoming referral code until signup. It is sent as auth metadata,
// then the database trigger records the attribution.
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
  document.getElementById('accountTitle').textContent = creating ? 'Create your account' : 'Welcome back';
  document.getElementById('accountMessage').textContent = creating ? 'Join VidEarn and get your own invite link.' : 'Sign in to manage your VidEarn account.';
  displayNameField.hidden = !creating;
  document.getElementById('displayName').required = creating;
  authSubmit.textContent = creating ? 'Create account' : 'Sign in';
  document.getElementById('switchAuth').textContent = creating ? 'Already registered? Sign in' : 'New here? Create an account';
  showAuthNotice('');
}
document.getElementById('switchAuth').addEventListener('click', () => setAuthMode(authMode === 'signin' ? 'signup' : 'signin'));
document.getElementById('closeAccount').addEventListener('click', () => accountDialog.close());
accountButton.addEventListener('click', () => {
  setAuthMode(currentUser ? 'signin' : 'signin');
  accountDialog.showModal();
});
signOutButton.addEventListener('click', async () => {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signOut();
  if (error) showAuthNotice(error.message, true);
  else showAuthNotice('You have signed out.');
});
accountForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!supabaseClient) {
    showAuthNotice('Supabase is not configured yet. Add your project URL and anon/publishable key in supabase-config.js.', true);
    return;
  }
  authSubmit.disabled = true;
  showAuthNotice('Please wait...');
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  let result;
  if (authMode === 'signup') {
    const referralCode = localStorage.getItem('videarn_referral_code') || '';
    result = await supabaseClient.auth.signUp({
      email, password,
      options: { data: {
        display_name: document.getElementById('displayName').value.trim(),
        referral_code: referralCode
      }}
    });
    if (!result.error && !result.data.session) {
      showAuthNotice('Account created. Check your email to confirm, then sign in.');
    }
  } else {
    result = await supabaseClient.auth.signInWithPassword({ email, password });
  }
  authSubmit.disabled = false;
  if (result.error) showAuthNotice(result.error.message, true);
  else if (result.data.session) {
    showAuthNotice(authMode === 'signup' ? 'Account created successfully.' : 'Signed in successfully.');
    await refreshAccount();
  }
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
  const { data: profile, error } = await supabaseClient
    .from('profiles').select('display_name, referral_code').eq('id', currentUser.id).maybeSingle();
  const displayName = profile?.display_name || currentUser.email?.split('@')[0] || 'U';
  accountButton.textContent = displayName.slice(0, 1).toUpperCase();
  signOutButton.hidden = false;
  if (error || !profile?.referral_code) {
    document.getElementById('referralStatus').textContent = 'Account connected. Apply the database setup SQL to enable your referral code.';
    return;
  }
  const link = new URL(location.href);
  link.search = '';
  link.hash = '';
  link.searchParams.set('ref', profile.referral_code);
  referralLink.textContent = link.toString();
  copyReferral.disabled = false;
  document.getElementById('referralStatus').textContent = 'Your referral code: ' + profile.referral_code + '. Referral rewards are not active until platform rules and payouts are launched.';
}
copyReferral.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(referralLink.textContent);
    document.getElementById('referralStatus').textContent = 'Referral link copied.';
  } catch {
    document.getElementById('referralStatus').textContent = 'Copy is unavailable in this browser. Press and hold the link to copy it.';
  }
});

(function initializeSupabase() {
  const config = window.VIDEARN_SUPABASE || {};
  if (!window.supabase || !config.url || !config.anonKey ||
      config.url.includes('YOUR_PROJECT') || config.anonKey.includes('YOUR_SUPABASE')) {
    document.getElementById('referralStatus').textContent = 'Website preview mode. Supabase connection details still need to be added.';
    return;
  }
  supabaseClient = window.supabase.createClient(config.url, config.anonKey);
  supabaseClient.auth.onAuthStateChange(() => { refreshAccount(); });
  refreshAccount();
})();
