(function(root) {
  const pageSize = 4;

  function getMemberPage(members, requestedPage) {
    const pageCount = Math.ceil(members.length / pageSize);
    const page = Math.max(0, Math.min(Math.trunc(requestedPage) || 0, pageCount - 1));
    return { page, pageCount, members: members.slice(page * pageSize, (page + 1) * pageSize) };
  }

  function setupMemberTilt(card, motionPreference) {
    const reset = () => {
      card.classList.remove('is-tilted');
      card.style.removeProperty('--card-rotate-x');
      card.style.removeProperty('--card-rotate-y');
    };
    card.addEventListener('pointermove', event => {
      if (motionPreference.matches || event.pointerType === 'touch') {
        reset();
        return;
      }
      const box = card.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, (event.clientX - box.left) / box.width * 2 - 1));
      const y = Math.max(-1, Math.min(1, (event.clientY - box.top) / box.height * 2 - 1));
      card.classList.add('is-tilted');
      card.style.setProperty('--card-rotate-x', `${-y * 4}deg`);
      card.style.setProperty('--card-rotate-y', `${x * 4}deg`);
    });
    card.addEventListener('pointerleave', reset);
    card.addEventListener('pointercancel', reset);
  }

  function mountTeamMembers(gallery, members, template, motionPreference) {
    const document = gallery.ownerDocument;
    const cards = gallery.querySelector('.profiles');
    const numbers = gallery.querySelector('.team-page-numbers');
    const previous = gallery.querySelector('[data-page-previous]');
    const next = gallery.querySelector('[data-page-next]');
    const status = gallery.querySelector('[data-page-status]');
    let currentPage = 0;

    const pageButtons = Array.from({ length: getMemberPage(members, 0).pageCount }, (_, page) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'team-page-button';
      button.textContent = String(page + 1);
      button.setAttribute('aria-label', `Member page ${page + 1}`);
      button.setAttribute('aria-controls', cards.id);
      button.addEventListener('click', () => render(page));
      numbers.append(button);
      return button;
    });

    function render(requestedPage) {
      const result = getMemberPage(members, requestedPage);
      currentPage = result.page;
      const fragment = document.createDocumentFragment();
      result.members.forEach(member => {
        const card = template.content.firstElementChild.cloneNode(true);
        card.querySelector('.member-name').textContent = member.name;
        const pronouns = card.querySelector('.member-pronouns');
        pronouns.textContent = member.pronouns ? `(${member.pronouns})` : '';
        pronouns.hidden = !member.pronouns;
        card.querySelector('.member-study').textContent = member.study || '';
        card.querySelector('.member-role').textContent = member.role || '';
        const photo = card.querySelector('.member-photo');
        if (member.photo) {
          const image = document.createElement('img');
          image.src = member.photo;
          image.alt = member.name;
          image.decoding = 'async';
          image.draggable = false;
          image.addEventListener('error', () => {
            image.remove();
            photo.setAttribute('role', 'img');
            photo.setAttribute('aria-label', `Photo coming soon for ${member.name}`);
          }, { once: true });
          photo.append(image);
        } else {
          photo.setAttribute('role', 'img');
          photo.setAttribute('aria-label', `Photo coming soon for ${member.name}`);
        }
        setupMemberTilt(card, motionPreference);
        fragment.append(card);
      });

      // Keep every page the same height, including an incomplete final page.
      if (result.members.length) {
        for (let slot = result.members.length; slot < pageSize; slot++) {
          const spacer = document.createElement('div');
          spacer.className = 'profile';
          spacer.setAttribute('aria-hidden', 'true');
          fragment.append(spacer);
        }
      } else {
        const empty = document.createElement('p');
        empty.textContent = 'Meet the team soon.';
        fragment.append(empty);
      }
      cards.replaceChildren(fragment);
      previous.disabled = currentPage === 0;
      next.disabled = currentPage >= result.pageCount - 1;
      pageButtons.forEach((button, page) => {
        if (page === currentPage) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      });
      gallery.querySelector('.team-pagination').hidden = result.pageCount <= 1;
      status.textContent = result.pageCount
        ? `Page ${currentPage + 1} of ${result.pageCount}. Members ${currentPage * pageSize + 1} to ${currentPage * pageSize + result.members.length} of ${members.length}.`
        : 'No members to display yet.';
      if (document.activeElement === previous && previous.disabled || document.activeElement === next && next.disabled) {
        pageButtons[currentPage]?.focus({ preventScroll: true });
      }
    }

    previous.addEventListener('click', () => render(currentPage - 1));
    next.addEventListener('click', () => render(currentPage + 1));
    render(0);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getMemberPage, setupMemberTilt, mountTeamMembers };
  } else {
    const gallery = root.document.querySelector('[data-member-gallery]');
    if (gallery) mountTeamMembers(
      gallery,
      JSON.parse(root.document.getElementById('team-member-data').textContent),
      root.document.getElementById('member-card-template'),
      root.matchMedia('(prefers-reduced-motion: reduce)')
    );
  }
})(typeof window === 'undefined' ? globalThis : window);
