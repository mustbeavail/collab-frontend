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

/* ── 지도 컴포넌트 ── */
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
