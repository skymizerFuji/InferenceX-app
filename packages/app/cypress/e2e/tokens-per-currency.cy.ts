/**
 * Tokens purchasable per $1 USD and the same quantities priced in yuan remain
 * available alongside the dashboard's throughput default. Fixed-sequence Quick
 * Filters remain available from the chart legend.
 */
describe('Tokens per currency and agentic controls', () => {
  beforeEach(() => {
    cy.window().then((win) => {
      win.localStorage.setItem('inferencex-star-modal-dismissed', String(Date.now()));
    });
  });

  it('defaults the y-axis to token throughput per chip', () => {
    cy.visit('/inference');
    cy.get('[data-testid="yaxis-metric-selector"]').should(
      'contain.text',
      'Token Throughput per Chip',
    );
    cy.get('[data-testid="scatter-graph"]')
      .first()
      .find('svg .dot-group')
      .should('have.length.greaterThan', 0);
  });

  it('still honors an explicit ?i_metric= from shared links', () => {
    cy.visit('/inference?i_metric=y_tokensPerDollarN');
    cy.get('[data-testid="yaxis-metric-selector"]').should(
      'contain.text',
      'Total Tokens per $1 USD (Owning - Neocloud Giant)',
    );
  });

  it('offers the same quantities priced in yuan', () => {
    cy.visit('/inference');
    cy.get('[data-testid="yaxis-metric-selector"]').click({ force: true });
    cy.get('[role="option"]')
      .contains('Total Tokens per ¥1 RMB (Owning - Hyperscaler)')
      .click({ force: true });
    cy.get('[data-testid="scatter-graph"]')
      .first()
      .find('svg .dot-group')
      .should('have.length.greaterThan', 0);
  });

  it('keeps Quick Filters for a fixed-sequence scenario', () => {
    cy.visit('/inference?i_seq=8k%2F1k');
    cy.get('[data-testid="scatter-quick-filters"]').click();
    cy.get('[data-testid="quick-filters-dialog"]').should('be.visible');
    cy.get('[data-testid="quick-filter-spec-mtp"]').should('exist');
  });
});
