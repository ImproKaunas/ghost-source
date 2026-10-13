import React, { useState } from 'react';
import { AdminLink } from '@/shared/admin-link';
import { Box, Container, Stack, Text } from '@tryghost/shade/primitives';
import {
  Button,
  EmptyIndicator,
  Input,
  Label,
  LoadingIndicator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tryghost/shade/components';
import { ListPage } from '@tryghost/shade/page-templates';
import { LucideIcon } from '@tryghost/shade/utils';
import { PageHeader } from '@tryghost/shade/patterns';
import { toast } from 'sonner';
import { useParams, useQueryClient } from '@tryghost/admin-x-framework';
import { useFetchApi } from '@tryghost/admin-x-framework/hooks';
import { apiUrl } from '@tryghost/admin-x-framework/helpers';
import { useBrowseMembers, type Member } from '@tryghost/admin-x-framework/api/members';
import { useBrowsePosts, postsDataType } from '@tryghost/admin-x-framework/api/posts';
import { parseRsvpSettings, rsvpLabelSlug, type RsvpPost, type RsvpSettings } from './frontmatter';

const lastSeen = (member: Member) =>
  member.last_seen_at ? new Date(member.last_seen_at).toLocaleDateString('lt-LT') : '';

/**
 * Event settings sidebar (capacity, label), toggleable like the post editor's
 * settings pane; values persist as `{rsvp: {...}}` JSON through the fork's
 * staff-only PUT /frontmatter/:id endpoint.
 */
const EventSettingsSidebar: React.FC<{ post: RsvpPost; initial: RsvpSettings }> = ({
  post,
  initial,
}) => {
  const fetchApi = useFetchApi();
  const queryClient = useQueryClient();
  const [capacity, setCapacity] = useState(initial.capacity?.toString() ?? '');
  const [label, setLabel] = useState(initial.label ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const rsvp: RsvpSettings = {};
    if (capacity.trim() !== '') {
      rsvp.capacity = Number(capacity);
    }
    if (label.trim() !== '') {
      rsvp.label = label.trim();
    }
    setSaving(true);
    try {
      await fetchApi(apiUrl(`/frontmatter/${post.id}/`), {
        method: 'PUT',
        body: JSON.stringify({ frontmatter: JSON.stringify({ rsvp }) }),
      });
      await queryClient.invalidateQueries({ queryKey: [postsDataType] });
      toast.success('Event settings saved');
    } catch {
      toast.error('Failed to save event settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside
      aria-label="Event settings"
      className="w-80 shrink-0 overflow-y-auto border-l border-border bg-sidebar max-[500px]:w-full"
      data-testid="rsvp-event-settings"
    >
      <Box className="px-5 py-4">
        <Text as="h2" size="lg" weight="semibold">
          Event settings
        </Text>
      </Box>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Stack className="px-5 py-4" gap="sm">
          <Label htmlFor="rsvp-capacity">Maximum attendees</Label>
          <Input
            id="rsvp-capacity"
            min="0"
            placeholder="∞"
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </Stack>
        <Stack className="px-5 py-4" gap="sm">
          <Label htmlFor="rsvp-label">RSVP label</Label>
          <Input
            id="rsvp-label"
            placeholder={`rsvp:${post.slug}`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </Stack>
        <Stack className="px-5 py-4" gap="sm">
          <Button disabled={saving} type="submit">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </Stack>
      </form>
    </aside>
  );
};

/** One RSVP event (local fork feature): its attendee roster and settings. */
const EventDetail: React.FC = () => {
  const { postId = '' } = useParams<{ postId: string }>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { data: postData, isLoading: postLoading } = useBrowsePosts({
    searchParams: { filter: `id:'${postId}'`, limit: '1' },
  });
  const post = postData?.posts[0];

  const labelSlug = post ? rsvpLabelSlug(post) : '';
  const { data: membersData, isLoading: membersLoading } = useBrowseMembers({
    searchParams: { filter: `label:'${labelSlug}'`, limit: 'all' },
    enabled: Boolean(post),
  });
  const members = membersData?.members ?? [];

  if (postLoading || (post && membersLoading)) {
    return (
      <div className="flex size-full items-center justify-center">
        <LoadingIndicator size="lg" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex size-full items-center justify-center">
        <EmptyIndicator title="Event not found">
          <LucideIcon.Ticket />
        </EmptyIndicator>
      </div>
    );
  }

  return (
    <Box className="flex size-full">
      <Box className="min-w-0 flex-1">
        <Container className="relative flex h-full flex-col" size="page">
          <ListPage data-testid="rsvp-event-page">
            <ListPage.Header>
              <PageHeader blurredBackground={false} sticky={false}>
                <PageHeader.Left>
                  <div className="flex flex-col">
                    <AdminLink
                      className="text-sm text-muted-foreground hover:underline"
                      to="/rsvp"
                    >
                      ← Events
                    </AdminLink>
                    <PageHeader.Title>{post.title}</PageHeader.Title>
                  </div>
                </PageHeader.Left>
                <PageHeader.Actions>
                  <PageHeader.ActionGroup>
                    <PageHeader.Action
                      aria-expanded={settingsOpen}
                      fallbackSize="sm"
                      fallbackVariant="ghost"
                      label="Event settings"
                      iconOnly
                      onClick={() => setSettingsOpen((open) => !open)}
                    >
                      <LucideIcon.PanelRight />
                    </PageHeader.Action>
                  </PageHeader.ActionGroup>
                </PageHeader.Actions>
              </PageHeader>
            </ListPage.Header>
            <ListPage.Body>
              {!members.length ? (
                <div className="flex flex-1 items-center justify-center">
                  <EmptyIndicator title="No attendees yet">
                    <LucideIcon.Users />
                  </EmptyIndicator>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto px-4">
                  <Table data-testid="rsvp-members-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name ({members.length})</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Last active</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((member) => (
                        <TableRow key={member.id} data-testid="rsvp-member-row">
                          <TableCell>
                            <AdminLink
                              className="font-semibold hover:underline"
                              to={`/members/${member.id}`}
                            >
                              {member.name || member.email}
                            </AdminLink>
                            {member.name ? (
                              <div className="text-sm text-muted-foreground">{member.email}</div>
                            ) : null}
                          </TableCell>
                          <TableCell className="max-w-96 truncate text-sm whitespace-pre-line">
                            {member.note}
                          </TableCell>
                          <TableCell>{lastSeen(member)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </ListPage.Body>
          </ListPage>
        </Container>
      </Box>
      {settingsOpen ? (
        <EventSettingsSidebar
          key={post.updated_at ?? post.id}
          initial={parseRsvpSettings(post)}
          post={post}
        />
      ) : null}
    </Box>
  );
};

export default EventDetail;
