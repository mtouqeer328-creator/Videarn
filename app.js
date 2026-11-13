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
