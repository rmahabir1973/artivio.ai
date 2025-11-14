# Artivio AI Design Guidelines

## Design Approach

**System**: Material Design with modern SaaS refinements, inspired by Kie.ai's clean aesthetic
**Rationale**: Productivity-focused platform requiring consistent UI patterns, clear information hierarchy, and intuitive controls for complex generation parameters

## Typography System

**Font Stack**: Inter (primary), system-ui fallback
- Headlines (H1): 2.5rem/3rem, font-weight 700
- Section Headers (H2): 1.875rem/2.25rem, font-weight 600  
- Subsections (H3): 1.5rem/2rem, font-weight 600
- Body Large: 1.125rem/1.75rem, font-weight 400
- Body Default: 1rem/1.5rem, font-weight 400
- Small/Caption: 0.875rem/1.25rem, font-weight 400
- Button Text: 0.875rem - 1rem, font-weight 500-600

## Spacing System

Use Tailwind units: **2, 4, 6, 8, 12, 16, 24**
- Component padding: p-6, p-8
- Section spacing: py-12, py-16, py-24
- Grid gaps: gap-4, gap-6, gap-8
- Element margins: mb-4, mb-6, mb-8, mb-12

## Layout Architecture

### Navigation
- **Top Navigation Bar**: Fixed header with logo (left), main nav links (center), user menu + credits display (right), h-16
- **Sidebar Navigation**: Collapsible left sidebar (w-64 expanded, w-16 collapsed) for generation tools with icons + labels
- **Breadcrumbs**: Below header for deep navigation (admin, generation history)

### Dashboard Layout
- **Grid System**: 12-column responsive grid
- **Card-Based**: All generation interfaces in elevated cards with subtle shadows
- **Two-Column Split**: Parameters/controls (left 40%), preview/output (right 60%)

### Generation Interfaces
**Common Pattern for Video/Image/Music**:
- Model selector dropdown (top)
- Parameter controls in vertical form layout (scrollable if needed)
- Prominent "Generate" button (large, full-width within controls section)
- Real-time preview/status area with loading states
- Generated content gallery below with download actions

### Admin Panel
- **User Management Table**: Sortable columns (Name, Email, Credits, Last Active, Actions)
- **API Key Manager**: Card grid showing 20 key slots with status indicators (active/inactive), usage metrics per key
- **Analytics Dashboard**: 4-column stat cards (Total Users, Active Generations, Credits Consumed, Success Rate)

## Core Components

### Cards
- Elevated cards: rounded-lg, shadow-md, p-6 to p-8
- Hover state: subtle shadow-lg transition
- Nested cards for settings groups within main generation cards

### Forms & Inputs
- Text inputs: rounded-md, border-2, h-10 to h-12, px-4
- Selects/Dropdowns: Same styling as text inputs with chevron icon
- Sliders: For numeric parameters (quality, duration) with value display
- Textareas: For prompts and lyrics, min-h-32, rounded-md, p-4

### Buttons
- Primary CTA: Large (h-12), rounded-lg, font-semibold, w-full for generation actions
- Secondary: Outlined variant, same height
- Icon buttons: Square (h-10 w-10), rounded-md for table actions
- Button groups: Segmented controls for model selection

### Generation Status
- Progress bars: Linear with percentage, rounded-full
- Status badges: Pill-shaped (Generating, Complete, Failed) with appropriate indicators
- Loading spinners: For active generation processes

### Media Display
- **Video Player**: Embedded player with standard controls, 16:9 aspect ratio containers
- **Image Gallery**: Masonry/grid layout with lightbox on click, aspect-ratio preserved thumbnails
- **Audio Player**: Custom controls showing waveform visualization, track info, download button

### Tables (Admin)
- Striped rows for readability
- Sticky headers on scroll
- Row actions (edit, delete, view details) as icon buttons in rightmost column
- Pagination controls at bottom

## Interaction Patterns

### Generation Flow
1. Select model from dropdown or tabs
2. Configure parameters via form controls
3. Enter prompt/description in textarea
4. Click prominent "Generate" button
5. Real-time status updates in preview area
6. Success state shows result with download/save options

### Navigation Flow
- Main dashboard: Overview with recent generations
- Generation tools: Separate pages for Video/Image/Music with full interface
- History: Filterable gallery of all generated content
- Admin: Protected area with user and API key management tabs

## Content Sections

### Homepage/Dashboard
- Hero section: Large heading "Create AI Content with Artivio AI", credit balance display, quick-start buttons for each generation type
- Recent Generations: 3-column grid showing last 6 items with thumbnails
- Statistics Overview: 4 metric cards (Credits Remaining, Generations Today, Success Rate, Favorite Model)

### Generation Pages
Each generation type (Video/Image/Music) follows consistent layout:
- Page header with icon + title
- Two-column layout: Controls sidebar (sticky) + Results area
- Model comparison cards showing features/pricing for each API option
- Generation history specific to that type at bottom

### Admin Pages
- **Users Tab**: Search bar, filter controls, user table, bulk action toolbar
- **API Keys Tab**: Visual grid of 20 key slots, add/edit/rotate modals, round-robin status indicator showing current active key
- **Analytics Tab**: Charts for usage trends, model popularity, credit consumption over time

## Images

**Hero Section**: Large, abstract AI-themed illustration showing interconnected nodes/neural networks with vibrant gradients, positioned as full-width background with overlay. Header and CTA buttons layered on top with backdrop-blur backgrounds.

**Model Preview Cards**: Use Kie.ai's actual model preview images (Veo, Runway, Suno, etc.) as card thumbnails when displaying available models.

**Empty States**: Custom illustrations for when users have no generations yet - friendly, encouraging tone with "Get Started" CTAs.

**Generation Results**: Display actual generated videos/images/audio with proper aspect ratios and quality preservation.

## Animations

- **Minimal Use**: Smooth transitions only (150-300ms)
- **Generation States**: Pulse animation on "Generating" status
- **Navigation**: Sidebar expand/collapse with slide transition
- **Cards**: Subtle hover lift (translateY -2px) with shadow increase
- **NO complex scroll animations or decorative motion**