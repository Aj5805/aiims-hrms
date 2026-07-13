import { Outlet } from 'react-router-dom';
import { SubmenuTabsNav } from '../components/SubmenuTabsNav';
import { getNavSection, getSectionTabs, type NavSectionId } from '../config/navSections';
import { useAuthStore } from '../stores';

type Props = {
  sectionId: NavSectionId;
};

export function SectionLayout({ sectionId }: Props) {
  const role = useAuthStore((s) => s.user?.role);
  const section = getNavSection(sectionId);
  const tabs = getSectionTabs(sectionId, role);

  if (!section || tabs.length === 0) {
    return <Outlet />;
  }

  return (
    <div className="section-layout space-y-3">
      <SubmenuTabsNav tabs={tabs} ariaLabel={section.title} />
      <Outlet />
    </div>
  );
}
