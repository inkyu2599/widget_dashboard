# Chart.js Static Resource

이 폴더에 Chart.js 4.x minified 파일을 배치하세요.

## 설치 방법

1. https://www.chartjs.org/docs/latest/getting-started/installation.html 에서 다운로드
2. `chart.umd.min.js` 파일을 이 폴더에 `chartjs.js` 로 저장
3. 이 폴더 전체를 zip으로 압축 → `chartjs.zip` 으로 저장
4. `sf project deploy start --source-dir force-app/main/default/staticresources` 로 배포

## cmDashboardWidgetChart에서의 사용

```js
import CHARTJS from '@salesforce/resourceUrl/chartjs';
loadScript(this, CHARTJS + '/chartjs.js');
```
