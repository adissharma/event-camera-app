import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

// Traced from dashboard-create-cta.png's alpha contour, inset 9 source pixels.
// Coordinates include the image's contain-fit inset inside its 52pt square.
const CREATE_OUTLINE = 'M50.332 26 C50.493 27.055 50.547 28.148 50.527 29.229 C50.507 30.310 50.395 31.408 50.210 32.487 C50.026 33.566 49.796 34.669 49.419 35.701 C49.043 36.732 48.563 37.765 47.953 38.674 C47.342 39.584 46.576 40.433 45.756 41.159 C44.936 41.885 43.989 42.514 43.033 43.033 C42.077 43.551 40.990 43.874 40.020 44.271 C39.049 44.668 38.101 44.971 37.210 45.416 C36.319 45.860 35.532 46.408 34.673 46.938 C33.814 47.469 32.973 48.081 32.055 48.599 C31.137 49.116 30.175 49.659 29.165 50.043 C28.156 50.427 27.075 50.747 26 50.901 C24.925 51.056 23.806 51.040 22.713 50.971 C21.619 50.901 20.511 50.738 19.439 50.485 C18.368 50.233 17.306 49.873 16.284 49.457 C15.261 49.041 14.266 48.535 13.305 47.988 C12.344 47.441 11.410 46.833 10.519 46.175 C9.628 45.517 8.770 44.801 7.960 44.040 C7.151 43.278 6.351 42.479 5.663 41.605 C4.976 40.731 4.350 39.781 3.836 38.797 C3.322 37.813 2.869 36.766 2.581 35.701 C2.292 34.635 2.175 33.496 2.104 32.403 C2.034 31.309 2.218 30.206 2.159 29.139 C2.100 28.072 1.837 27.058 1.750 26 C1.662 24.942 1.575 23.859 1.634 22.792 C1.693 21.725 1.840 20.635 2.104 19.597 C2.369 18.559 2.755 17.528 3.220 16.564 C3.684 15.600 4.286 14.689 4.893 13.814 C5.499 12.938 6.164 12.105 6.858 11.312 C7.551 10.518 8.287 9.764 9.054 9.054 C9.821 8.344 10.626 7.674 11.460 7.051 C12.294 6.428 13.163 5.848 14.058 5.316 C14.953 4.784 15.877 4.289 16.829 3.859 C17.780 3.428 18.768 3.077 19.766 2.733 C20.763 2.389 21.774 2.061 22.813 1.796 C23.853 1.530 24.919 1.280 26 1.139 C27.081 0.998 28.196 0.919 29.298 0.949 C30.400 0.978 31.544 1.053 32.613 1.318 C33.683 1.584 34.764 1.988 35.716 2.543 C36.669 3.098 37.566 3.841 38.329 4.646 C39.091 5.451 39.714 6.448 40.292 7.374 C40.870 8.301 41.294 9.313 41.795 10.205 C42.297 11.096 42.775 11.915 43.302 12.723 C43.829 13.532 44.402 14.267 44.958 15.055 C45.514 15.843 46.083 16.623 46.638 17.452 C47.192 18.281 47.797 19.121 48.284 20.029 C48.771 20.937 49.218 21.903 49.559 22.898 C49.900 23.894 50.170 24.945 50.332 26 Z';

/** Gallery-style specular rim, shaped for each of the dashboard's actions. */
export function DashboardButtonGlassBorder({ shape }: { shape: 'profile' | 'create' }) {
  const id = `button-glass-${useId().replace(/:/g, '')}`;
  const stroke = `url(#${id})`;
  return (
    <Svg width={52} height={52} viewBox="0 0 52 52" style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
      <Defs>
        <LinearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0" stopColor="#F0F2F5" stopOpacity={0.12} />
          <Stop offset="0.07" stopColor="#D6E8FF" stopOpacity={0.65} />
          <Stop offset="0.13" stopColor="#FFFFFF" stopOpacity={0.95} />
          <Stop offset="0.24" stopColor="#F0F2F5" stopOpacity={0.18} />
          <Stop offset="0.44" stopColor="#F0F2F5" stopOpacity={0.04} />
          <Stop offset="0.64" stopColor="#D6E8FF" stopOpacity={0.25} />
          <Stop offset="0.74" stopColor="#FFFFFF" stopOpacity={0.85} />
          <Stop offset="0.83" stopColor="#F0F2F5" stopOpacity={0.14} />
          <Stop offset="0.95" stopColor="#E1EDFF" stopOpacity={0.62} />
          <Stop offset="1" stopColor="#F0F2F5" stopOpacity={0.12} />
        </LinearGradient>
      </Defs>
      {shape === 'create' ? (
        <Path d={CREATE_OUTLINE} fill="none" stroke={stroke} strokeWidth={0.75} />
      ) : (
        <Circle cx={26} cy={26} r={25.5} fill="none" stroke={stroke} strokeWidth={1} />
      )}
    </Svg>
  );
}
