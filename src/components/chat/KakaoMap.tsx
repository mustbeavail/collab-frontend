'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    kakao: any;
    daum: any;
  }
}

const KAKAO_SDK_ID  = 'kakao-maps-sdk';
const POSTCODE_ID   = 'daum-postcode-sdk';

function appendScript(id: string, src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      // 이미 로드됐으면 즉시 resolve
      if (id === KAKAO_SDK_ID  && window.kakao)         { resolve(); return; }
      if (id === POSTCODE_ID   && window.daum?.Postcode) { resolve(); return; }
      // 로드 중이면 이벤트 대기
      const el = document.getElementById(id) as HTMLScriptElement;
      el.addEventListener('load',  () => resolve(), { once: true });
      el.addEventListener('error', reject,           { once: true });
      return;
    }
    const s = document.createElement('script');
    s.id  = id;
    s.src = src;
    s.addEventListener('load',  () => resolve(), { once: true });
    s.addEventListener('error', reject,           { once: true });
    document.head.appendChild(s);
  });
}

/** Kakao Maps SDK(+services) 초기화 */
export async function loadKakaoSdk(): Promise<void> {
  await appendScript(
    KAKAO_SDK_ID,
    `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&libraries=services&autoload=false`,
  );
  await new Promise<void>((resolve) => window.kakao.maps.load(resolve));
}

/**
 * 카카오 주소 검색 팝업을 열고, 주소 + 좌표를 콜백으로 전달한다.
 * 지오코딩 실패 시 lat/lng = 0 으로 반환.
 */
export async function openAddressSearch(
  onSelect: (address: string, lat: number, lng: number) => void,
): Promise<void> {
  await loadKakaoSdk();
  await appendScript(
    POSTCODE_ID,
    '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js',
  );

  new window.daum.Postcode({
    oncomplete: (data: any) => {
      const address = data.roadAddress || data.jibunAddress;
      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.addressSearch(address, (result: any[], status: string) => {
        if (status === window.kakao.maps.services.Status.OK) {
          onSelect(address, parseFloat(result[0].y), parseFloat(result[0].x));
        } else {
          onSelect(address, 0, 0);
        }
      });
    },
  }).open();
}

/**
 * 좌표 → 주소 역지오코딩(지도 클릭으로 위치 지정 시 사용).
 * 실패 시 빈 문자열 반환.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  await loadKakaoSdk();
  return new Promise((resolve) => {
    const geocoder = new window.kakao.maps.services.Geocoder();
    // coord2Address 인자 순서: (경도 x, 위도 y)
    geocoder.coord2Address(lng, lat, (result: any[], status: string) => {
      if (status === window.kakao.maps.services.Status.OK && result[0]) {
        const r = result[0];
        resolve(r.road_address?.address_name || r.address?.address_name || '');
      } else {
        resolve('');
      }
    });
  });
}

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.9780 }; // 서울시청

/* ── 위치 선택 지도(항상 표시, 클릭으로 지정) ── */
interface KakaoLocationPickerProps {
  lat: number | null;
  lng: number | null;
  onPick: (address: string, lat: number, lng: number) => void;
  className?: string;
}

export function KakaoLocationPicker({ lat, lng, onPick, className }: KakaoLocationPickerProps) {
  const ref       = useRef<HTMLDivElement>(null);
  const mapRef    = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  // 최초 1회 지도 생성 + 클릭 리스너 등록
  useEffect(() => {
    let cancelled = false;
    loadKakaoSdk().then(() => {
      if (cancelled || !ref.current || mapRef.current) return;
      const hasPoint = lat != null && lng != null;
      const center = new window.kakao.maps.LatLng(
        hasPoint ? lat : DEFAULT_CENTER.lat,
        hasPoint ? lng : DEFAULT_CENTER.lng,
      );
      const map = new window.kakao.maps.Map(ref.current, { center, level: 4 });
      const marker = new window.kakao.maps.Marker({ position: center });
      if (hasPoint) marker.setMap(map); // 좌표 있으면 마커 표시
      mapRef.current = map;
      markerRef.current = marker;

      window.kakao.maps.event.addListener(map, 'click', (mouseEvent: any) => {
        const latlng = mouseEvent.latLng;
        const la = latlng.getLat();
        const ln = latlng.getLng();
        marker.setPosition(latlng);
        marker.setMap(map);
        reverseGeocode(la, ln).then((addr) => onPickRef.current(addr, la, ln));
      });
    });
    return () => { cancelled = true; };
    // 최초 1회만 생성(좌표 동기화는 아래 effect가 담당)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 외부에서 좌표가 바뀌면(주소검색 결과 등) 지도/마커 동기화
  useEffect(() => {
    if (!mapRef.current || lat == null || lng == null) return;
    const pos = new window.kakao.maps.LatLng(lat, lng);
    mapRef.current.setCenter(pos);
    markerRef.current.setPosition(pos);
    markerRef.current.setMap(mapRef.current);
  }, [lat, lng]);

  return <div ref={ref} className={className} style={{ width: '100%', height: '100%' }} />;
}

/* ── 지도 컴포넌트(읽기 전용 표시) ── */
interface KakaoMapProps {
  lat: number;
  lng: number;
  className?: string;
}

export default function KakaoMap({ lat, lng, className }: KakaoMapProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadKakaoSdk().then(() => {
      if (cancelled || !ref.current) return;
      const coords = new window.kakao.maps.LatLng(lat, lng);
      const map = new window.kakao.maps.Map(ref.current, { center: coords, level: 4 });
      new window.kakao.maps.Marker({ map, position: coords });
    });
    return () => { cancelled = true; };
  }, [lat, lng]);

  return <div ref={ref} className={className} style={{ width: '100%', height: '100%' }} />;
}
