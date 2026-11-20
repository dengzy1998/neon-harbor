/** Small DOM adapter. Gameplay state remains owned by Game and its systems. */
export class Hud {
  constructor(doc = document) {
    this.doc = doc;
    const ids = [
      'hud',
      'minimap-wrap',
      'minimap',
      'district-label',
      'stats',
      'stars',
      'heat-bar',
      'heat-label',
      'cash',
      'rank-wrap',
      'radio-line',
      'rank-name',
      'rp-bar',
      'speedo',
      'vitals',
      'hp-bar',
      'ar-bar',
      'weapon',
      'weapon-strip',
      'mission-panel',
      'mission-title',
      'mission-stage',
      'mission-count',
      'contacts-panel',
      'contact-plates',
      'contact-fix',
      'response-panel',
      'response-list',
      'dialogue',
      'dlg-portrait',
      'dlg-name',
      'dlg-role',
      'dlg-text',
      'popups',
      'banner',
      'banner-title',
      'banner-sub',
      'toast',
    ];
    this.elements = {};
    for (const id of ids) {
      const element = doc.getElementById(id);
      if (!element) {
        throw new Error(`Hud requires #${id}`);
      }
      this.elements[id] = element;
    }
    this.hpFill = this.elements['hp-bar'].querySelector('i');
    this.armourFill = this.elements['ar-bar'].querySelector('i');
    this.rankFill = this.elements['rp-bar'].querySelector('i');
    this.heatFill = this.elements['heat-bar'].querySelector('i');
    this.contactRows = new Map(
      ['plates', 'fix'].map(id => {
        const row = this.elements[`contact-${id}`];
        return [id, {
          root: row,
          name: row.querySelector('.c-name'),
          state: row.querySelector('.c-state'),
          fill: row.querySelector('.c-bar i'),
        }];
      }),
    );
    this.contactRowCache = new Map();
    this.lastContactsState = '';
    this.lastHeatWidth = null;
    this.lastWeaponState = null;
    this.weaponSlots = [...this.elements['weapon-strip'].querySelectorAll('.wslot')];
    this.money = new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
    });
    this.timers = new Set();
    this.popupTimers = new Map();
    this.bannerTimer = null;
    this.toastTimer = null;
    this.starNodes = [];
    this.elements.stars.replaceChildren();
    for (let index = 0; index < 5; index++) {
      const star = doc.createElement('span');
      star.textContent = '★';
      star.setAttribute('aria-hidden', 'true');
      this.elements.stars.append(star);
      this.starNodes.push(star);
    }
    this.setStars(0);
    this.setRadio('');
    this.setMission(null);
    this.setResponse(null);
    this.elements.banner.hidden = true;
    this.elements.toast.hidden = true;
    this.showHud(false);
  }

  el(id) {
    return this.elements[id];
  }

  finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  percentage(value) {
    return Math.max(0, Math.min(100, this.finite(value)));
  }

  later(callback, delay) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, delay);
    this.timers.add(timer);
    return timer;
  }

  cancel(timer) {
    if (timer === null || timer === undefined) {
      return;
    }
    clearTimeout(timer);
    this.timers.delete(timer);
  }

  setCash(number) {
    const amount = Math.round(this.finite(number));
    this.elements.cash.textContent = `$${this.money.format(amount)}`;
  }

  setRank(name, frac01) {
    this.elements['rank-name'].textContent = name || 'Deckhand';
    const percent = this.percentage(this.finite(frac01) * 100);
    this.rankFill.style.width = `${percent}%`;
    this.elements['rp-bar'].setAttribute('aria-valuenow', String(percent));
  }

  setRadio(text) {
    const line = this.elements['radio-line'];
    line.textContent = text || '';
    line.hidden = !text;
  }

  setStars(number) {
    const count = Math.max(0, Math.min(5, Math.ceil(this.finite(number))));
    for (let index = 0; index < this.starNodes.length; index++) {
      this.starNodes[index].classList.toggle('lit', index < count);
    }
    this.elements.stars.setAttribute('aria-label', `${count} of 5 wanted stars`);
  }

  setHeatLabel(text) {
    this.elements['heat-label'].textContent = text || 'OFF THE RADAR';
  }

  setHeat(frac01) {
    const percent = this.percentage(this.finite(frac01) * 100);
    const width = `${Math.round(percent * 10) / 10}%`;
    if (width !== this.lastHeatWidth) {
      this.heatFill.style.width = width;
      this.lastHeatWidth = width;
      this.elements['heat-bar'].setAttribute('aria-valuenow', String(Math.round(percent)));
    }
  }

  setContacts(stateArray) {
    const rows = Array.isArray(stateArray) ? stateArray : [];
    const displayRows = rows.map(item => {
      const row = this.contactRows.get(item.id);
      if (!row) return null;
      const remaining = Math.max(0, this.finite(item.remaining));
      const cooldown = Math.max(0, this.finite(item.cooldown));
      const ready = Boolean(item.ready) || remaining <= 0;
      const seconds = Math.ceil(remaining);
      const percent = ready || cooldown <= 0
        ? 0
        : this.percentage((remaining / cooldown) * 100);
      const width = `${Math.round(percent * 10) / 10}%`;
      const displayState = ready ? 'READY' : `READY IN ${seconds}s`;
      const name = `${item.name || item.id} · ${item.contactName || ''}`.trim();
      return { id: item.id, row, ready, width, displayState, name };
    }).filter(Boolean);
    const signature = JSON.stringify(displayRows.map(({ id, ready, width, displayState, name }) => [
      id,
      name,
      displayState,
      ready,
      width,
    ]));
    if (signature === this.lastContactsState) {
      return;
    }
    this.lastContactsState = signature;
    for (const { id, row, ready, width, displayState, name } of displayRows) {
      const signature = JSON.stringify([name, displayState, ready, width]);
      if (this.contactRowCache.get(id) === signature) {
        continue;
      }
      row.name.textContent = name;
      row.state.textContent = displayState;
      row.fill.style.width = width;
      row.root.classList.toggle('ready', ready);
      row.root.classList.toggle('cooling', !ready);
      this.contactRowCache.set(id, signature);
    }
  }

  setWeapons(weapons, activeId, unlockedSet) {
    const unlocked = unlockedSet instanceof Set
      ? unlockedSet
      : new Set(Array.isArray(unlockedSet) ? unlockedSet : []);
    const rows = this.weaponSlots.map(slot => {
      const id = slot.dataset.weapon;
      const stats = weapons?.[id];
      const isUnlocked = unlocked.has(id);
      const isActive = activeId === id;
      const damage = this.finite(stats?.dmg);
      return [id, stats?.name || id || 'Weapon', damage, isUnlocked, isActive];
    });
    const signature = JSON.stringify(rows);
    if (signature === this.lastWeaponState) {
      return;
    }
    this.lastWeaponState = signature;
    this.weaponSlots.forEach((slot, index) => {
      const [id, name, damage, isUnlocked, isActive] = rows[index];
      slot.querySelector('.w-name').textContent = name;
      slot.querySelector('.w-dmg').textContent = isUnlocked ? `DMG ${damage}` : '';
      slot.querySelector('.w-lock').textContent = isUnlocked ? '' : `LOCKED · ${index + 1}`;
      slot.classList.toggle('active', isActive);
      slot.classList.toggle('locked', !isUnlocked);
      slot.setAttribute('aria-label', isUnlocked
        ? `${index + 1}: ${name}, damage ${damage}${isActive ? ', active' : ''}`
        : `${index + 1}: ${name}, locked`);
      slot.dataset.weapon = id;
    });
  }

  setSpeed(kmh) {
    const speed = Math.round(Math.abs(this.finite(kmh)));
    this.elements.speedo.textContent = `${speed} km/h`;
  }

  setVitals(hp, armour) {
    const healthPercent = this.percentage(hp);
    const armourPercent = this.percentage(armour);
    this.hpFill.style.width = `${healthPercent}%`;
    this.armourFill.style.width = `${armourPercent}%`;
    this.elements['hp-bar'].setAttribute('aria-valuenow', String(healthPercent));
    this.elements['ar-bar'].setAttribute('aria-valuenow', String(armourPercent));
    this.elements.vitals.classList.toggle('critical', healthPercent <= 25);
  }

  setWeapon(name) {
    this.elements.weapon.textContent = name || 'Fists';
  }

  setMission(mission) {
    const panel = this.elements['mission-panel'];
    panel.hidden = !mission;
    if (!mission) {
      return;
    }
    this.elements['mission-title'].textContent = mission.title || '';
    this.elements['mission-stage'].textContent = mission.stageText || '';
    const index = Math.max(1, Math.floor(this.finite(mission.index, 1)));
    const count = Math.max(index, Math.floor(this.finite(mission.count, index)));
    this.elements['mission-count'].textContent = `STAGE ${index} OF ${count}`;
  }

  setResponse(units) {
    const list = this.elements['response-list'];
    const active = Array.isArray(units) ? units : [];
    this.elements['response-panel'].hidden = active.length === 0;
    const fragment = this.doc.createDocumentFragment();
    for (const unit of active) {
      const row = this.doc.createElement('li');
      const distance = Math.max(0, Math.round(this.finite(unit.dist)));
      const state = String(unit.state || 'pursue').toUpperCase();
      row.textContent = `${unit.callsign || 'UNIT'} · ${state} · ${distance}m`;
      fragment.append(row);
    }
    list.replaceChildren(fragment);
  }

  removePopup(node) {
    const timers = this.popupTimers.get(node) || [];
    for (const timer of timers) {
      this.cancel(timer);
    }
    this.popupTimers.delete(node);
    node.remove();
  }

  popup(main, sub = '') {
    const feed = this.elements.popups;
    while (feed.children.length >= 4) {
      this.removePopup(feed.firstElementChild);
    }
    const node = this.doc.createElement('div');
    node.className = 'popup';
    const heading = this.doc.createElement('strong');
    heading.textContent = String(main);
    node.append(heading);
    if (sub) {
      const detail = this.doc.createElement('small');
      detail.textContent = String(sub);
      node.append(detail);
    }
    feed.append(node);
    const fade = this.later(() => {
      node.classList.add('fading');
    }, 2150);
    const remove = this.later(() => {
      this.removePopup(node);
    }, 2600);
    this.popupTimers.set(node, [fade, remove]);
  }

  banner(title, sub = '') {
    this.cancel(this.bannerTimer);
    this.elements['banner-title'].textContent = String(title);
    this.elements['banner-sub'].textContent = String(sub);
    this.elements.banner.hidden = false;
    this.bannerTimer = this.later(() => {
      this.elements.banner.hidden = true;
      this.bannerTimer = null;
    }, 2800);
  }

  toast(text) {
    this.cancel(this.toastTimer);
    this.elements.toast.textContent = String(text);
    this.elements.toast.hidden = false;
    this.toastTimer = this.later(() => {
      this.elements.toast.hidden = true;
      this.toastTimer = null;
    }, 2200);
  }

  showHud(visible) {
    this.elements.hud.classList.toggle('on', Boolean(visible));
    this.elements.hud.setAttribute('aria-hidden', String(!visible));
  }

  setDistrict(name) {
    this.elements['district-label'].textContent = name || 'Neon Harbor';
  }

  dialogueElements() {
    return {
      box: this.elements.dialogue,
      portrait: this.elements['dlg-portrait'],
      name: this.elements['dlg-name'],
      role: this.elements['dlg-role'],
      text: this.elements['dlg-text'],
    };
  }

  destroy() {
    // Cancelling timers makes this safe to reuse in a new game session.
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.popupTimers.clear();
    this.elements.popups.replaceChildren();
    this.elements.banner.hidden = true;
    this.elements.toast.hidden = true;
    this.showHud(false);
  }
}
