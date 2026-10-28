import { getRoomsPage } from './queries';
import { RoomsSection } from './components/rooms-section';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <RoomsSection data={await getRoomsPage(await searchParams)} />;
}
