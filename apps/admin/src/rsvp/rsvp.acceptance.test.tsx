import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';

import {
  currentRoute,
  fakeAdminEndpoint,
  fakeMembers,
  fakePosts,
  member,
  post,
  renderAdminApp,
} from '@test-utils/acceptance';

const eventPost = (overrides = {}) =>
  post({
    title: 'Improvizacijos dirbtuvės',
    slug: 'improvizacijos-dirbtuves',
    status: 'published',
    published_at: '2026-10-01T18:00:00.000Z',
    frontmatter: JSON.stringify({ rsvp: { capacity: 14 } }),
    ...overrides,
  });

describe('RSVP events', () => {
  it('lists #rsvp posts with status, date and capacity', async () => {
    const posts = fakePosts([eventPost()]);
    await renderAdminApp('/rsvp');

    const row = page.getByTestId('rsvp-event-row');
    await expect.element(row).toBeVisible();
    await expect.element(row).toHaveTextContent('Improvizacijos dirbtuvės');
    await expect.element(row).toHaveTextContent('published');
    await expect.element(row).toHaveTextContent('14');

    // The screen asks only for event posts.
    expect(posts.lastRequest?.filter).toBe('tag:hash-rsvp');
  });

  it('shows the empty state when no event posts exist', async () => {
    fakePosts([]);
    await renderAdminApp('/rsvp');

    await expect.element(page.getByRole('heading', { name: 'No events found' })).toBeVisible();
  });

  it('opens an event: roster filtered by the rsvp label slug, settings prefilled', async () => {
    const event = eventPost();
    fakePosts([event]);
    const members = fakeMembers([
      member({ name: 'Jonas Jonaitis', email: 'jonas@example.com', note: 'vegetaras' }),
    ]);
    await renderAdminApp(`/rsvp/${event.id}`);

    const row = page.getByTestId('rsvp-member-row');
    await expect.element(row).toBeVisible();
    await expect.element(row).toHaveTextContent('Jonas Jonaitis');
    await expect.element(row).toHaveTextContent('vegetaras');

    // Registrations are named `rsvp:<post-slug>`; the roster queries the slugified label.
    expect(members.lastRequest?.filter).toBe("label:'rsvp-improvizacijos-dirbtuves'");

    // The settings sidebar is toggleable (as in the editor) and carries the stored capacity.
    await page.getByRole('button', { name: 'Event settings' }).click();
    await expect.element(page.getByLabelText('Maximum attendees')).toHaveValue(14);
    await page.getByRole('button', { name: 'Event settings' }).click();
    await expect.element(page.getByTestId('rsvp-event-settings')).not.toBeInTheDocument();
  });

  it('saves settings through the frontmatter endpoint', async () => {
    const event = eventPost();
    fakePosts([event]);
    fakeMembers([]);
    const frontmatter = fakeAdminEndpoint('PUT', `/frontmatter/${event.id}/`, {});
    await renderAdminApp(`/rsvp/${event.id}`);

    await page.getByRole('button', { name: 'Event settings' }).click();
    await page.getByLabelText('Maximum attendees').fill('20');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect.poll(() => frontmatter.requests.length).toBe(1);
    const body = frontmatter.lastRequest?.body as { frontmatter: string };
    expect(JSON.parse(body.frontmatter)).toEqual({ rsvp: { capacity: 20 } });
  });

  it('navigates from the list to the event page', async () => {
    const event = eventPost();
    fakePosts([event]);
    fakeMembers([]);
    await renderAdminApp('/rsvp');

    await page.getByRole('link', { name: 'Improvizacijos dirbtuvės', exact: true }).click();
    await expect.poll(currentRoute).toBe(`/rsvp/${event.id}`);
  });
});
