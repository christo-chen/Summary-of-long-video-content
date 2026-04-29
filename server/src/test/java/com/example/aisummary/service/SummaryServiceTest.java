package com.example.aisummary.service;

import com.example.aisummary.dto.SummaryRequest;
import com.example.aisummary.dto.SummaryResponse;
import com.example.aisummary.entity.Summary;
import com.example.aisummary.entity.SummaryTag;
import com.example.aisummary.mapper.SummaryMapper;
import com.example.aisummary.mapper.SummaryTagMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SummaryServiceTest {

    @Mock
    private SummaryMapper summaryMapper;

    @Mock
    private SummaryTagMapper summaryTagMapper;

    @InjectMocks
    private SummaryService summaryService;

    private static final Long USER_ID    = 1L;
    private static final Long SUMMARY_ID = 10L;
    private static final Long TAG_ID     = 20L;

    // ---- saveSummary ----

    @Test
    void saveSummary_mapsRequestFieldsAndCallsInsert() {
        SummaryRequest req = new SummaryRequest();
        req.setUrl("https://example.com/article");
        req.setTitle("Test Article");
        req.setSourceType("article");
        req.setSummaryJson("{\"one_line\":\"summary\"}");
        req.setLanguage("zh");

        Summary result = summaryService.saveSummary(USER_ID, req);

        verify(summaryMapper).insert(any(Summary.class));
        assertThat(result.getUserId()).isEqualTo(USER_ID);
        assertThat(result.getUrl()).isEqualTo("https://example.com/article");
        assertThat(result.getTitle()).isEqualTo("Test Article");
        assertThat(result.getSourceType()).isEqualTo("article");
    }

    // ---- getSummaryDetail ----

    @Test
    void getSummaryDetail_found_returnsResponse() {
        SummaryResponse expected = new SummaryResponse();
        expected.setId(SUMMARY_ID);
        expected.setTitle("Detail Title");
        when(summaryMapper.selectSummaryDetail(SUMMARY_ID, USER_ID)).thenReturn(expected);

        SummaryResponse result = summaryService.getSummaryDetail(SUMMARY_ID, USER_ID);

        assertThat(result).isEqualTo(expected);
    }

    @Test
    void getSummaryDetail_notFound_throwsRuntimeException() {
        when(summaryMapper.selectSummaryDetail(anyLong(), anyLong())).thenReturn(null);

        assertThatThrownBy(() -> summaryService.getSummaryDetail(99L, USER_ID))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("不存在");
    }

    // ---- deleteSummary ----

    @Test
    void deleteSummary_validOwner_deletesTagsAndSummary() {
        Summary summary = new Summary();
        summary.setId(SUMMARY_ID);
        summary.setUserId(USER_ID);
        when(summaryMapper.selectById(SUMMARY_ID)).thenReturn(summary);

        summaryService.deleteSummary(SUMMARY_ID, USER_ID);

        verify(summaryTagMapper).delete(any());
        verify(summaryMapper).deleteById(SUMMARY_ID);
    }

    @Test
    void deleteSummary_wrongUser_throwsRuntimeException() {
        Summary summary = new Summary();
        summary.setId(SUMMARY_ID);
        summary.setUserId(999L);
        when(summaryMapper.selectById(SUMMARY_ID)).thenReturn(summary);

        assertThatThrownBy(() -> summaryService.deleteSummary(SUMMARY_ID, USER_ID))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("无权");
    }

    // ---- addTag ----

    @Test
    void addTag_notYetLinked_insertsSummaryTag() {
        Summary summary = new Summary();
        summary.setId(SUMMARY_ID);
        summary.setUserId(USER_ID);
        when(summaryMapper.selectById(SUMMARY_ID)).thenReturn(summary);
        when(summaryTagMapper.selectCount(any())).thenReturn(0L);

        summaryService.addTag(SUMMARY_ID, TAG_ID, USER_ID);

        verify(summaryTagMapper).insert(argThat(st ->
                SUMMARY_ID.equals(st.getSummaryId()) && TAG_ID.equals(st.getTagId())));
    }

    @Test
    void addTag_alreadyLinked_doesNotInsertDuplicate() {
        Summary summary = new Summary();
        summary.setId(SUMMARY_ID);
        summary.setUserId(USER_ID);
        when(summaryMapper.selectById(SUMMARY_ID)).thenReturn(summary);
        when(summaryTagMapper.selectCount(any())).thenReturn(1L);

        summaryService.addTag(SUMMARY_ID, TAG_ID, USER_ID);

        verify(summaryTagMapper, never()).insert(any(SummaryTag.class));
    }
}
