import { CAST } from '../missions/Dialogue.js';

/**
 * Contacts are small, high-impact favors that Mara can call from the street.
 * Each entry in this list is data first so the HUD and future mission content
 * can describe the same ability without duplicating names or timings.
 */
export const CONTACTS = [
  {
    id: 'plates',
    name: 'Swap Plates',
    contact: 'bea',
    blurb: 'Bea fits fresh plates: lose 1 star of heat.',
    key: 'KeyQ',
    cooldown: 90,
  },
  {
    id: 'fix',
    name: 'Quick Fix',
    contact: 'otto',
    blurb: 'Otto talks you through a roadside repair: car fully repaired.',
    key: 'KeyT',
    cooldown: 120,
  },
];

const finite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

/**
 * Owns cooldown bookkeeping for the contact abilities.
 *
 * The class deliberately knows very little about the rest of the game. It
 * receives a WantedSystem and a car when an ability is used, which keeps the
 * side effects explicit and makes the state useful to staged scenes and HUD
 * tests as well as the live game loop.
 */
export class Contacts {
  constructor() {
    this.cooldowns = Object.fromEntries(CONTACTS.map(contact => [contact.id, 0]));
  }

  /** Reset all favors to their ready state for a fresh session. */
  reset() {
    for (const contact of CONTACTS) {
      this.cooldowns[contact.id] = 0;
    }
  }

  /** Tick every active timer without allowing a negative display value. */
  update(dt) {
    const seconds = Math.max(0, finite(dt));
    for (const contact of CONTACTS) {
      this.cooldowns[contact.id] = Math.max(
        0,
        finite(this.cooldowns[contact.id]) - seconds,
      );
    }
  }

  /** Return true when an ability can be called right now. */
  ready(id) {
    return this.remaining(id) <= 0;
  }

  /** Return a non-negative number of seconds until an ability is ready. */
  remaining(id) {
    return Math.max(0, finite(this.cooldowns[id]));
  }

  _definition(id) {
    return CONTACTS.find(contact => contact.id === id) || null;
  }

  _start(id) {
    const definition = this._definition(id);
    if (definition) {
      this.cooldowns[id] = definition.cooldown;
    }
  }

  /**
   * Ask Bea to swap plates. Wanted heat is lowered by one whole star, while
   * fractional heat is retained. The return value lets Game show a toast.
   */
  usePlates(wanted) {
    if (!wanted || !this.ready('plates') || finite(wanted.heat) <= 0) {
      return false;
    }
    wanted.heat = Math.max(0, finite(wanted.heat) - 1);
    wanted._sync?.();
    this._start('plates');
    return true;
  }

  /** Restore the current car to full health through Otto's advice. */
  useFix(car) {
    if (!car || !this.ready('fix')) {
      return false;
    }
    car.health = 100;
    this._start('fix');
    return true;
  }

  /**
   * Produce the compact shape consumed by Hud.setContacts.
   * Cast names come from Dialogue so contact rows stay consistent with
   * portraits and spoken dialogue elsewhere in the game.
   */
  state() {
    return CONTACTS.map(contact => ({
      id: contact.id,
      name: contact.name,
      contactName: CAST[contact.contact]?.name || contact.contact,
      ready: this.ready(contact.id),
      remaining: this.remaining(contact.id),
      cooldown: contact.cooldown,
    }));
  }
}

// Keep this module intentionally readable: these tiny helpers are useful when
// inspecting a staged scene in a browser console during content work.
export function contactById(id) {
  return CONTACTS.find(contact => contact.id === id) || null;
}

export function contactKey(id) {
  return contactById(id)?.key || '';
}

export function contactCooldown(id) {
  return contactById(id)?.cooldown || 0;
}

export function contactBlurb(id) {
  return contactById(id)?.blurb || '';
}

export function contactName(id) {
  const contact = contactById(id);
  return contact ? (CAST[contact.contact]?.name || contact.contact) : '';
}

export function isContact(id) {
  return Boolean(contactById(id));
}
