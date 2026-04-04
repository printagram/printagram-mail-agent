# Dev Log

## 2026-04-04 — Dashboard polish + smarter categorization
### Done
- Dashboard: switched font to Exo 2, all font sizes +2px
- Fixed ChartDataLabels plugin registration (percentage labels now visible)
- Category Trends chart moved to full-width row
- Languages chart: legend moved to right side
- Unified all chart legend fonts to 16px
- Categorization: dynamic subcategory + closest_category for all categories
- Strengthened price_request category description (quote/pricing/cost keywords)
- General category now requires explanation of closest match in summary
- Added Alibaba category (🏭) to seed and live DB
- Updated category descriptions in production Supabase (xvxrcpxdfdcsncfnuwcf)
- Added build script stub in package.json for Hostinger compatibility

### Discussions
- [Supabase projects]: discovered MCP tool is connected to main Printagram project, not mail agent project. Mail agent uses separate Supabase (xvxrcpxdfdcsncfnuwcf). Must use REST API via curl for mail agent DB.
- [System status]: confirmed mail agent is live — 393+ emails processed, all modules working

### Decisions
- Dynamic subcategory/closest_category instead of hardcoded per-category rules — more flexible, works for any future categories

### Next
1. Verify Hostinger deploy after build script fix
2. Review categorization quality with new subcategory/closest_category fields
3. Consider adding more categories based on actual email patterns
4. Phase 2: auto-replies for price_request, skip notifications for spam_promo

---

## 2026-04-03 — Analytics dashboard [unverified — reconstructed from git]
### Done
- Added analytics API endpoints (src/analytics.js)
- Built dashboard UI with charts (src/dashboard.html)
- Added percentage labels to pie charts and weekly category distribution chart
