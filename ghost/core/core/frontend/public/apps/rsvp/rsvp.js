// This is a quick and dirty client script,
// enabling basic functionality while we figure out
// how it's best for us to use the RSVP system.

async function sendRsvpAcion(uri, button, container) {

    container.classList.add('rsvp-loading');
    const data =  container.classList.contains('rsvp-status-true') ?
        await fetch(uri, { credentials: 'same-origin', method: 'DELETE' }) :
        await fetch(uri, { credentials: 'same-origin', method: 'POST' });
    
    if (data.ok) {
        const json = await data.json();
        setRsvpContainerState(container, json);
    } else {
        container.classList.add('rsvp-error');
        await updateRsvpState(uri);
    }

    container.classList.remove('rsvp-loading');
}

async function updateRsvpState(uri) {
   
    const container = document.querySelector(`[data-rsvp-uri="${uri}"]`);
    container.classList.add('rsvp-loading');

    const data = await fetch(uri, { credentials: 'same-origin' });
    const json = await data.json();

    setRsvpContainerState(container, json);

    container.classList.remove('rsvp-loading');

    return json;
}

function setRsvpContainerState(container, state) {
    if (state.rsvp) {
        container.classList.add('rsvp-status-true');
        container.classList.remove('rsvp-status-false');
        container.querySelectorAll('.rsvp-action-link').forEach((link) => {
            if (link.getAttribute('data-rsvp-initialTextContent') !== '') {
            link.textContent = 'Atšaukti';
            }
        });
    } else {
        container.classList.add('rsvp-status-false');
        container.classList.remove('rsvp-status-true');
        container.querySelectorAll('.rsvp-action-link').forEach((link) => {
            if (link.getAttribute('data-rsvp-initialTextContent') !== '') {
                link.textContent = link.getAttribute('data-rsvp-initialTextContent');
            }
        });
    }

    if (state.event.capacity.isFull) {
        container.classList.add('rsvp-event-full');
    } else {
        container.classList.remove('rsvp-event-full');
    }

    if (state.event.capacity.isLimited) {
        container.classList.add('rsvp-event-limited');
    } else {
        container.classList.remove('rsvp-event-limited');
    }

    container.classList.remove('rsvp-error');
}

async function enableRsvp(container) {
    const links = container.querySelectorAll(`a[href^="${window.location.origin}/rsvp"]`);
    const uri = links[0]?.href;
    if (!uri) return;

    container.setAttribute('data-rsvp-uri', uri);
    links.forEach(link => {
        link.classList.add('rsvp-action-link');

        link.setAttribute('data-rsvp-initialTextContent', link.textContent);
        link.addEventListener('click', async function(e) {
            e.preventDefault();
            sendRsvpAcion(link.href, link, container);
        });
    });

    await updateRsvpState(uri);
    container.classList.add('rsvp-enabled');   
}


document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.kg-cta-card').forEach(enableRsvp);
});