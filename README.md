# The Hello Pages — V2

This is the polished GitHub Pages prototype.

### Current features
- Digital book interface
- Page navigation
- Premium pages 1–5: £10/square
- Semi-premium pages 6–9: £5/square
- Standard pages 10+: £1.50/square
- 37 × 37 pixel selection grid
- 3-square minimum
- Demo sold squares
- Advert builder and live preview
- Demo checkout
- Responsive design

### Production architecture
GitHub Pages is static, so real automated sales should use:
- GitHub Pages for the front end
- Stripe Checkout for payments and Apple Pay / Google Pay
- A serverless webhook for verified payments
- Supabase (or another database) for adverts and square ownership
- Storage for uploaded advert images

Never put Stripe secret keys in browser JavaScript.

### Quick local preview
From the project directory:
python3 -m http.server 8000

Then open the forwarded port in Codespaces.
