const assert = require('node:assert/strict');
const sinon = require('sinon');
const knex = require('knex').default;
const DomainEvents = require('@tryghost/domain-events');

const Tier = require('../../../../../../../core/server/services/tiers/tier');

// Initialise i18n before requiring the service so its destructured `t` import
// resolves to the live i18next instance. The init helper falls back to 'en'
// when the locale setting isn't set.
const i18n = require('../../../../../../../core/server/services/i18n');
i18n.init();

const PaymentsService = require('../../../../../../../core/server/services/members/members-api/services/payments-service');

describe('PaymentsService', function () {
  let Bookshelf;
  let db;

  beforeAll(async function () {
    db = knex({
      client: 'better-sqlite3',
      useNullAsDefault: true,
      connection: {
        filename: ':memory:',
      },
    });
    await db.schema.createTable('offers', function (table) {
      table.string('id', 24);
      table.string('stripe_coupon_id', 255);
      table.string('discount_type', 191);
    });
    await db.schema.createTable('stripe_products', function (table) {
      table.string('id', 24);
      table.string('product_id', 24);
      table.string('stripe_product_id', 255);
    });
    await db.schema.createTable('stripe_prices', function (table) {
      table.string('id', 24);
      table.string('stripe_price_id', 255);
      table.string('stripe_product_id', 255);
      table.boolean('active');
      table.string('nickname', 191);
      table.string('currency', 50);
      table.integer('amount');
      table.string('type', 50);
      table.string('interval', 50);
    });
    await db.schema.createTable('stripe_customers', function (table) {
      table.string('id', 24);
      table.string('member_id', 24);
      table.string('stripe_customer_id', 255);
      table.string('name', 191);
      table.string('email', 191);
    });

    Bookshelf = require('bookshelf')(db);
  });

  beforeEach(async function () {
    await db('offers').truncate();
    await db('stripe_products').truncate();
    await db('stripe_prices').truncate();
    await db('stripe_customers').truncate();
  });

  afterAll(async function () {
    await db.destroy();
  });

  afterEach(function () {
    // PaymentsService's constructor subscribes to DomainEvents on every build.
    // These tests construct the service many times over a shared static
    // EventEmitter, so clear listeners between tests to avoid a leak warning
    // and to stop this file's listeners leaking into other files (isolate:false).
    DomainEvents.ee.removeAllListeners();
  });

  describe('getPaymentLink', function () {
    it('Can handle 404 from Stripe', async function () {
      const BaseModel = Bookshelf.Model.extend(
        {},
        {
          async add() {},
          async edit() {},
        },
      );
      const Offer = BaseModel.extend({
        tableName: 'offers',
      });
      const StripeProduct = BaseModel.extend({
        tableName: 'stripe_products',
      });
      const StripePrice = BaseModel.extend({
        tableName: 'stripe_prices',
      });
      const StripeCustomer = BaseModel.extend({
        tableName: 'stripe_customers',
      });

      const offersAPI = {};
      const stripeAPIService = {
        createCheckoutSession: sinon.fake.resolves({
          url: 'https://checkout.session',
        }),
        getCustomer: sinon.fake(),
        createCustomer: sinon.fake(),
        getProduct: sinon.fake.resolves({
          id: 'prod_1',
          active: true,
        }),
        editProduct: sinon.fake(),
        createProduct: sinon.fake.resolves({
          id: 'prod_1',
          active: true,
        }),
        getPrice: sinon.fake.rejects(new Error('Price does not exist')),
        createPrice: sinon.fake(function (data) {
          return Promise.resolve({
            id: 'price_1',
            active: data.active,
            unit_amount: data.amount,
            currency: data.currency,
            nickname: data.nickname,
            recurring: {
              interval: data.interval,
            },
          });
        }),
        createCoupon: sinon.fake(),
      };
      const service = new PaymentsService({
        Offer,
        StripeProduct,
        StripePrice,
        StripeCustomer,
        offersAPI,
        stripeAPIService,
      });

      const tier = await Tier.create({
        name: 'Test tier',
        slug: 'test-tier',
        currency: 'usd',
        monthlyPrice: 1000,
        yearlyPrice: 10000,
      });

      const price = StripePrice.forge({
        id: 'id_1',
        stripe_price_id: 'price_1',
        stripe_product_id: 'prod_1',
        active: true,
        interval: 'month',
        nickname: 'Monthly',
        currency: 'usd',
        amount: 1000,
        type: 'recurring',
      });

      const product = StripeProduct.forge({
        id: 'id_1',
        stripe_product_id: 'prod_1',
        product_id: tier.id.toHexString(),
      });

      await price.save(null, { method: 'insert' });
      await product.save(null, { method: 'insert' });

      const cadence = 'month';
      const offer = null;
      const member = null;
      const metadata = {};
      const options = {};

      const url = await service.getPaymentLink({
        tier,
        cadence,
        offer,
        member,
        metadata,
        options,
      });

      assert(url);
    });

    it('Can remove trial days in case of an existing coupon', async function () {
      const BaseModel = Bookshelf.Model.extend(
        {},
        {
          async add() {},
          async edit() {},
        },
      );
      const Offer = BaseModel.extend({
        tableName: 'offers',
        where: () => {
          return {
            query: () => {
              return {
                select: () => {
                  return {
                    first: sinon.stub().resolves({
                      stripe_coupon_id: 'stripe_coupon_1',
                    }),
                  };
                },
              };
            },
          };
        },
      });
      const StripeProduct = BaseModel.extend({
        tableName: 'stripe_products',
      });
      const StripePrice = BaseModel.extend({
        tableName: 'stripe_prices',
      });
      const StripeCustomer = BaseModel.extend({
        tableName: 'stripe_customers',
      });

      const offersAPI = {};

      const stripeAPIService = {
        createCheckoutSession: sinon.fake.resolves({
          url: 'https://checkout.session',
        }),
        getCustomer: sinon.fake(),
        createCustomer: sinon.fake(),
        getProduct: sinon.fake.resolves({
          id: 'prod_1',
          active: true,
        }),
        editProduct: sinon.fake(),
        createProduct: sinon.fake.resolves({
          id: 'prod_1',
          active: true,
        }),
        getPrice: sinon.fake(function () {
          return Promise.resolve({
            id: 'price_1',
          });
        }),
        createPrice: sinon.fake(function (data) {
          return Promise.resolve({
            id: 'price_1',
            active: data.active,
            unit_amount: data.amount,
            currency: data.currency,
            nickname: data.nickname,
            recurring: {
              interval: data.interval,
            },
          });
        }),
        createCoupon: sinon.fake(),
      };
      const service = new PaymentsService({
        Offer,
        StripeProduct,
        StripePrice,
        StripeCustomer,
        offersAPI,
        stripeAPIService,
      });

      const tier = await Tier.create({
        name: 'Test tier',
        slug: 'test-tier',
        currency: 'usd',
        monthlyPrice: 1000,
        yearlyPrice: 10000,
        trialDays: 7,
      });

      const price = StripePrice.forge({
        id: 'id_1',
        stripe_price_id: 'price_1',
        stripe_product_id: 'prod_1',
        active: true,
        interval: 'month',
        nickname: 'Monthly',
        currency: 'usd',
        amount: 1000,
        type: 'recurring',
      });

      const product = StripeProduct.forge({
        id: 'id_1',
        stripe_product_id: 'prod_1',
        product_id: tier.id.toHexString(),
      });

      await price.save(null, { method: 'insert' });
      await product.save(null, { method: 'insert' });

      const cadence = 'month';
      const offer = {
        id: 'discount_offer_1',
        tier: {
          id: tier.id.toHexString(),
        },
      };
      const member = null;
      const metadata = {};
      const options = {};

      await service.getPaymentLink({
        tier,
        cadence,
        offer,
        member,
        metadata,
        options,
      });

      // assert trialDays should not be set when coupon is present for checkout session
      assert.equal(
        stripeAPIService.createCheckoutSession.getCall(0).args[2].coupon,
        'stripe_coupon_1',
      );
      assert.equal(stripeAPIService.createCheckoutSession.getCall(0).args[2].trialDays, undefined);
    });
  });

  describe('getDonationPriceNickname', function () {
    function createService(title) {
      return new PaymentsService({
        settingsCache: {
          get(key) {
            return key === 'title' ? title : undefined;
          },
        },
      });
    }

    afterEach(function () {
      i18n.changeLanguage('en');
    });

    // The fork replaces upstream's "Support {siteTitle}" nickname with a
    // random phrase from the theatre's own list, so upstream's four
    // title-interpolation tests don't apply.
    it('returns one of the fork donation phrases, within Stripe limits', function () {
      const service = createService('My Site');
      const seen = new Set();
      for (let i = 0; i < 50; i++) {
        seen.add(service.getDonationPriceNickname());
      }
      for (const phrase of seen) {
        assert.equal(typeof phrase, 'string');
        assert.ok(phrase.length > 0 && phrase.length <= 250);
      }
      assert.ok(seen.size > 1, 'phrases are picked at random');
    });
  });
});
