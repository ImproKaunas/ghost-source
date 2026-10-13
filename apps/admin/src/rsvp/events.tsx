import React from 'react';
import { AdminLink } from '@/shared/admin-link';
import { Box, Container } from '@tryghost/shade/primitives';
import {
  Badge,
  Button,
  EmptyIndicator,
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
import { useBrowsePosts } from '@tryghost/admin-x-framework/api/posts';
import { parseRsvpSettings, type RsvpPost } from './frontmatter';

const eventDate = (post: RsvpPost) => {
  const date = post.published_at ?? post.updated_at;
  return date ? new Date(date).toLocaleDateString('lt-LT') : '';
};

const statusVariant = (status: RsvpPost['status']) =>
  status === 'published' ? 'success' : status === 'scheduled' ? 'warning' : 'secondary';

/** RSVP events screen (local fork feature): every post tagged #rsvp. */
const Events: React.FC = () => {
  const { data, isError, isLoading } = useBrowsePosts({
    searchParams: {
      filter: 'tag:hash-rsvp',
      order: 'published_at desc',
      limit: 'all',
    },
  });
  const posts = (data?.posts ?? []) as RsvpPost[];

  return (
    <Box className="size-full">
      <Container className="relative flex h-full flex-col" size="page">
        <ListPage data-testid="rsvp-events-page">
          <ListPage.Header>
            <PageHeader blurredBackground={false} sticky={false}>
              <PageHeader.Left>
                <PageHeader.Title>Events</PageHeader.Title>
              </PageHeader.Left>
            </PageHeader>
          </ListPage.Header>
          <ListPage.Body>
            {isLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <LoadingIndicator size="lg" />
              </div>
            ) : isError ? (
              <div className="flex flex-1 flex-col items-center justify-center">
                <h2 className="mb-2 text-xl font-medium">Error loading events</h2>
                <p className="mb-4 text-muted-foreground">Please reload the page to try again</p>
                <Button onClick={() => window.location.reload()}>Reload page</Button>
              </div>
            ) : !posts.length ? (
              <div className="flex flex-1 items-center justify-center">
                <EmptyIndicator title="No events found">
                  <LucideIcon.Ticket />
                </EmptyIndicator>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead className="sr-only">Edit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {posts.map((post) => {
                      const { capacity } = parseRsvpSettings(post);
                      return (
                        <TableRow key={post.id} data-testid="rsvp-event-row">
                          <TableCell>
                            <AdminLink
                              className="font-semibold hover:underline"
                              to={`/rsvp/${post.id}`}
                            >
                              {post.title}
                            </AdminLink>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(post.status)}>{post.status}</Badge>
                          </TableCell>
                          <TableCell>{eventDate(post)}</TableCell>
                          <TableCell>{capacity ?? '∞'}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" asChild>
                              <AdminLink
                                aria-label={`Edit ${post.title} in editor`}
                                to={`/editor/post/${post.id}`}
                              >
                                <LucideIcon.Pen className="size-4" />
                              </AdminLink>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </ListPage.Body>
        </ListPage>
      </Container>
    </Box>
  );
};

export default Events;
