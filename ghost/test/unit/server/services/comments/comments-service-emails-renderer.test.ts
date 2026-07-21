import assert from 'node:assert/strict';
import i18nLib from '@tryghost/i18n';
// @ts-expect-error This module lacks type definitions.
import CommentsServiceEmailRenderer from '../../../../../core/server/services/comments/comments-service-email-renderer';

describe('Comments Service Email Renderer', function () {
  describe('renderEmail Template with different locales', function () {
    it('should render html and text templates with English locale', async function () {
      // arrange
      const i18n = i18nLib('en', 'ghost');
      const renderer = new CommentsServiceEmailRenderer({ t: i18n.t });

      const templateData = {
        postTitle: 'Test Post',
        postUrl: 'https://ghost.org/post',
        siteUrl: 'https://ghost.org',
      };

      // act
      const result = await renderer.renderEmailTemplate('new-comment-reply', templateData);

      // assert
      assert(result.html.includes('Hey there,</p>'));
      assert(
        result.html.includes(
          'This message was sent from <a class="small" href="https://ghost.org"',
        ),
      );
      assert(
        result.html.includes(
          'Someone just replied to your comment on <a href="https://ghost.org/post"',
        ),
      );
      assert(result.text.includes('Hey there,'));
      assert(result.text.includes('Someone just replied to your comment on Test Post.'));
    });

    it('should correctly handle apostrophes in post titles and site names', async function () {
      // arrange
      const i18n = i18nLib('en', 'ghost');
      const renderer = new CommentsServiceEmailRenderer({ t: i18n.t });

      const templateData = {
        postTitle: "Test post's the best post",
        siteUrl: 'https://ghost.org',
        siteDomain: "Cathy's blog",
      };

      // act
      const result = await renderer.renderEmailTemplate('new-comment-reply', templateData);

      // assert
      assert(result.html.includes('Hey there,</p>'));
      assert(
        result.html.includes(
          'This message was sent from <a class="small" href="https://ghost.org" style="text-decoration: underline; color: #738A94; font-size: 11px;">Cathy\'s blog</a>',
        ),
      );
      assert(
        result.text.includes("Someone just replied to your comment on Test post's the best post."),
      );
    });

    it('should render html and text templates with Lithuanian locale', async function () {
      // arrange
      const i18n = i18nLib('lt', 'ghost');
      const renderer = new CommentsServiceEmailRenderer({ t: i18n.t });

      const templateData = {
        postTitle: 'Testinis įrašas',
        postUrl: 'https://ghost.lt/post',
        siteUrl: 'https://ghost.lt',
      };

      // act
      const result = await renderer.renderEmailTemplate('new-comment-reply', templateData);

      // assert
      assert(result.html.includes('Labas,</p>'));
      assert(result.html.includes('href="https://ghost.lt/post"'));
      assert(result.text.includes('Labas,'));
      assert(result.text.includes('Kažkas atsakė į tavo komentarą įraše Testinis įrašas.'));
    });
  });
});
