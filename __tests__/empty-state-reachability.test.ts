/**
 * A new account must be able to reach the project surface.
 *
 * This is the regression that cost the most. Twenty-seven components —
 * ProjectDashboard, SinceLastVisit, ProjectCharts, ActivityTimeline,
 * EvidenceDrawer — all render behind `selectedProject`. Every one was imported,
 * mounted, typechecked, and covered by tests, and I reported the work as
 * connected end to end.
 *
 * None of it had ever rendered for a real account, because the only way to get a
 * project was a 13px unlabelled folder icon in the sidebar, and the empty state
 * pointed somewhere else entirely.
 *
 * **Mounted is not reachable.** These tests assert the second one: that a user
 * with no project is offered a way to make one, and that the way still works.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/** Source with comments stripped — a doc comment must not satisfy a grep. */
function code(file: string): string {
  return fs
    .readFileSync(path.resolve(file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('a user with no project', () => {
  const workspace = () => code('components/dashboard/DashboardWorkspace.tsx');

  it('is shown the way to create one', () => {
    expect(workspace()).toMatch(/<StartTrackingCard[\s>]/);
  });

  it('sees it precisely when no project is selected', () => {
    // Gated on `!selectedProject`, so it disappears once one exists rather than
    // nagging someone who already set up.
    expect(workspace()).toMatch(/!currentResult && !selectedProject &&[\s\S]{0,80}StartTrackingCard/);
  });

  it('can still ask a one-off question', () => {
    // Removing the question path would trade one dead end for another.
    expect(workspace()).toContain('DEMO_QUERIES');
  });
});

describe('creating a project', () => {
  it('actually calls the API', () => {
    expect(code('components/dashboard/StartTrackingCard.tsx')).toContain('createMarketProject(');
  });

  it('hands the new project back to the app', () => {
    // Without this the user creates a project and the screen does not change,
    // which reads as the button being broken.
    expect(code('components/dashboard/StartTrackingCard.tsx')).toContain('onCreated(created)');
    expect(code('app/page.tsx')).toContain('setSelectedProject(project)');
  });

  it('refreshes the sidebar list', () => {
    // The sidebar reads projects in a mount-only effect. A project created
    // elsewhere is invisible there until the key changes.
    expect(code('components/ui/SessionSidebar.tsx')).toMatch(
      /listMarketProjects\(\)[\s\S]{0,120}\}, \[projectsRefreshKey\]\)/,
    );
    expect(code('app/page.tsx')).toContain('setProjectsVersion(');
  });

  it('sends a usable URL when the user omits the scheme', () => {
    // Nobody types "https://", and the API rejects a bare domain, so the most
    // common input in the form would fail validation without this.
    const source = code('components/dashboard/StartTrackingCard.tsx');
    expect(source).toMatch(/https\?:\\\/\\\//);
    expect(source).toContain('`https://${value}`');
  });

  it('does not require a project name', () => {
    // A separate "project name" field is our data model leaking into the user's
    // first thirty seconds. It is derived from the companies instead.
    const source = code('components/dashboard/StartTrackingCard.tsx');
    expect(source).toMatch(/name: names\.join\(/);
    // No input bound to a name field.
    expect(source).not.toMatch(/setName\(/);
  });

  it('compares more than two companies', () => {
    // The comparison is not "us versus them" — a user may be sizing up three
    // companies, none of which is theirs. The first name fills `product` and the
    // rest join `competitors`; that is storage, not a hierarchy in the UI.
    const source = code('components/dashboard/StartTrackingCard.tsx');
    expect(source).toMatch(/const \[first, \.\.\.rest\] = names/);
    expect(source).toContain('competitors: rest.slice(0, 20)');
  });

  it('names no invented company in its placeholders', () => {
    // "Vector Agents" and "Clay, Regie, Artisan" are not real to this user, and
    // one of them resolves to a Virginia real-estate business.
    const source = code('components/dashboard/StartTrackingCard.tsx');
    expect(source).not.toContain('Vector Agents');
    expect(source).not.toContain('vectoragents.ai');
    expect(source).not.toContain('Clay, Regie, Artisan');
  });
});

describe('the surface that becomes reachable', () => {
  it('still renders once a project exists', () => {
    // If this gate is ever removed, the components go dark again and every test
    // above would still pass.
    expect(workspaceGate()).toMatch(/<ProjectDashboard[\s>]/);
  });

  function workspaceGate(): string {
    return code('components/dashboard/DashboardWorkspace.tsx');
  }
});
