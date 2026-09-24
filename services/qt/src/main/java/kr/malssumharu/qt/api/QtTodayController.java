package kr.malssumharu.qt.api;

import kr.malssumharu.qt.service.QtTodayService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** 요청 파라미터·개인 정보를 받지 않는다. 개인 계획·읽은 범위와 무관하다. */
@RestController
public class QtTodayController {

    private final QtTodayService service;

    public QtTodayController(QtTodayService service) {
        this.service = service;
    }

    @GetMapping("/api/qt/today")
    public QtTodayResponse today() {
        return service.today();
    }
}
