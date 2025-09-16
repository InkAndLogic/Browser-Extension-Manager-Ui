/* Browser Extensions Manager UI logic */
(function () {
	const STORAGE_KEY = 'extensions';
	const THEME_KEY = 'theme';

	const els = {
		cards: document.getElementById('cards'),
		template: document.getElementById('card-template'),
		search: document.getElementById('searchInput'),
		pills: Array.from(document.querySelectorAll('.filters .pill')),
		themeToggle: document.getElementById('themeToggle'),
		body: document.body,
	};

	let state = {
		items: [],
		filter: 'all',
		query: '',
		theme: 'light',
	};

	// ----- Theme -----
	function applyTheme(theme) {
		state.theme = theme;
		els.body.classList.toggle('theme-dark', theme === 'dark');
		els.body.classList.toggle('theme-light', theme === 'light');
		localStorage.setItem(THEME_KEY, theme);
	}

	function initTheme() {
		const saved = localStorage.getItem(THEME_KEY);
		if (saved === 'dark' || saved === 'light') {
			applyTheme(saved);
			return;
		}
		const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
		applyTheme(prefersDark ? 'dark' : 'light');
	}

	if (els.themeToggle) {
		els.themeToggle.addEventListener('click', () => {
			applyTheme(state.theme === 'dark' ? 'light' : 'dark');
		});
	}

	// ----- Data load/persist -----
	function save() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
		} catch (e) {
			console.warn('Unable to save extensions to localStorage:', e);
		}
	}

	async function load() {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			try {
				state.items = JSON.parse(saved);
				return;
			} catch (_) {}
		}
		// Seed from data.json on first load
		try {
			const res = await fetch('./data.json', { cache: 'no-cache' });
			if (!res.ok) throw new Error(res.statusText);
			state.items = await res.json();
			save();
		} catch (err) {
			console.error('Failed to load data.json:', err);
			state.items = [];
		}
	}

	// ----- Render -----
	function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

	function getFiltered(items) {
		const q = state.query.trim().toLowerCase();
		return items.filter((it) => {
			const matchesFilter =
				state.filter === 'all' ? true : state.filter === 'active' ? it.isActive : !it.isActive;
			const matchesQuery = !q || (it.name + ' ' + it.description).toLowerCase().includes(q);
			return matchesFilter && matchesQuery;
		});
	}

	function render() {
		const items = getFiltered(state.items);
		clear(els.cards);

		if (!items.length) {
			const p = document.createElement('p');
			p.textContent = state.query ? 'No extensions match your search.' : 'No extensions available.';
			p.style.opacity = '0.7';
			els.cards.appendChild(p);
			return;
		}

		for (const item of items) {
			const card = els.template.content.firstElementChild.cloneNode(true);
			card.dataset.name = item.name;
			card.dataset.active = String(!!item.isActive);

			const img = card.querySelector('.logo');
			const name = card.querySelector('.name');
			const desc = card.querySelector('.desc');
			const toggle = card.querySelector('.toggle');
			const removeBtn = card.querySelector('.remove-btn');

			img.src = item.logo;
			img.alt = `${item.name} logo`;
			name.textContent = item.name;
			desc.textContent = item.description;
			toggle.checked = !!item.isActive;

			toggle.addEventListener('change', () => {
				setActive(item.name, toggle.checked);
			});
			removeBtn.addEventListener('click', () => {
				remove(item.name);
			});

			els.cards.appendChild(card);
		}
	}

	// ----- Mutations -----
	function setActive(name, value) {
		const it = state.items.find((x) => x.name === name);
		if (it) {
			it.isActive = !!value;
			save();
			render();
		}
	}

	function remove(name) {
		const idx = state.items.findIndex((x) => x.name === name);
		if (idx !== -1) {
			state.items.splice(idx, 1);
			save();
			render();
		}
	}

	// ----- Filters/Search -----
	function setActivePill(target) {
		els.pills.forEach((p) => {
			const on = p === target;
			p.classList.toggle('is-active', on);
			p.setAttribute('aria-selected', String(on));
		});
	}

	els.pills.forEach((pill) => {
		pill.addEventListener('click', () => {
			state.filter = pill.dataset.filter || 'all';
			setActivePill(pill);
			render();
		});
	});

	if (els.search) {
		els.search.addEventListener('input', (e) => {
			state.query = e.currentTarget.value;
			render();
		});
		els.search.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') {
				e.currentTarget.value = '';
				state.query = '';
				render();
			}
		});
	}

	// ----- Init -----
	(async function init() {
		initTheme();
		await load();
		// Ensure default pill visual state matches 'all'
		const defaultPill = els.pills.find((p) => (p.dataset.filter || 'all') === state.filter);
		if (defaultPill) setActivePill(defaultPill);
		render();
	})();
})();

